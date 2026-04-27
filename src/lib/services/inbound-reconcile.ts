import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversation, customer, message } from "@/db/schema";
import { loadChannelConnection } from "@/lib/providers/sender-factory";
import {
  QUEUES,
  safeEnqueue,
  type LlmReplyJob,
  type VoiceTranscribeJob,
} from "@/lib/queue";

/**
 * Self-healing pass for inbound messages that never got an AI reply.
 *
 * Why this exists:
 *   - The webhook (Amplify) inserts the inbound message into Postgres and
 *     then enqueues an `inbound-message` job to Redis. If Redis is briefly
 *     unreachable from the Lambda (cold-start blip, security group hiccup,
 *     etc.) the row is in DB but no job exists — the user never gets a reply.
 *   - The worker scans every minute for such "orphaned" inbound messages
 *     and directly enqueues an `llm-reply` (text) or `voice-transcribe`
 *     (voice note) job, bypassing the inbound-message queue entirely. The
 *     conversation is also confirmed to still be in `bot` mode.
 *
 * Bounded:
 *   - Only looks back 15 minutes (older = give up, agent will see in inbox).
 *   - Only picks rows that have NO outbound message after them.
 *   - Marks `inbound_reconciled_at` so we never double-enqueue.
 */
export async function reconcileInboundReplies(batchSize = 50): Promise<{
  found: number;
  enqueued: number;
}> {
  // CTE: pick orphans + lock them in a single statement so two worker
  // replicas can run this every minute without stepping on each other.
  const rows = await db.execute<{
    id: string;
    organization_id: string;
    conversation_id: string;
    content_type: string;
    media_url: string | null;
    media_mime_type: string | null;
  }>(sql`
    WITH orphans AS (
      SELECT m.id, m.organization_id, m.conversation_id, m.content_type,
             m.media_url, m.media_mime_type
      FROM message m
      JOIN conversation c ON c.id = m.conversation_id
      WHERE m.direction = 'inbound'
        AND m.created_at >= NOW() - interval '15 minutes'
        AND m.created_at <= NOW() - interval '2 seconds'
        AND m.inbound_reconciled_at IS NULL
        AND c.mode = 'bot'
        AND c.status <> 'closed'
        AND m.content_type IN ('text', 'voice_note')
        AND NOT EXISTS (
          SELECT 1 FROM message m2
          WHERE m2.conversation_id = m.conversation_id
            AND m2.direction = 'outbound'
            AND m2.created_at > m.created_at
        )
      ORDER BY m.created_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE message
    SET inbound_reconciled_at = NOW()
    FROM orphans
    WHERE message.id = orphans.id
    RETURNING message.id, message.organization_id, message.conversation_id,
              message.content_type, message.media_url, message.media_mime_type;
  `);

  type OrphanRow = {
    id: string;
    organization_id: string;
    conversation_id: string;
    content_type: string;
    media_url: string | null;
    media_mime_type: string | null;
  };
  const list: OrphanRow[] = Array.isArray(rows)
    ? (rows as unknown as OrphanRow[])
    : ((rows as unknown as { rows?: OrphanRow[] }).rows ?? []);

  let enqueued = 0;
  for (const r of list) {
    // Best-effort: blue ticks + name back-fill for orphans too. We do this
    // here because reconciled messages bypass `inbound-message` (where the
    // happy path normally handles these).
    void postRoutingSideEffects(r.id, r.organization_id, r.conversation_id);

    if (r.content_type === "voice_note") {
      // Voice notes need transcription FIRST. The voice-transcribe handler
      // chains an llm-reply job on success.
      if (!r.media_url) {
        console.warn(`[reconcile] voice_note ${r.id} has no media_url; skipping`);
        continue;
      }
      const vj: VoiceTranscribeJob = {
        organizationId: r.organization_id,
        messageId: r.id,
        mediaUrl: r.media_url,
        mediaMimeType: r.media_mime_type ?? undefined,
      };
      const res = await safeEnqueue(QUEUES.voiceTranscribe, vj, {
        jobId: `vt:reconcile:${r.id}`,
      });
      if (res.ok) enqueued++;
      else
        console.warn(
          `[reconcile] could not enqueue voice-transcribe for ${r.id}: ${res.error}`,
        );
    } else {
      const job: LlmReplyJob = {
        organizationId: r.organization_id,
        conversationId: r.conversation_id,
        triggeringMessageId: r.id,
      };
      const res = await safeEnqueue(QUEUES.llmReply, job, {
        jobId: `llm:reconcile:${r.id}`,
      });
      if (res.ok) enqueued++;
      else
        console.warn(
          `[reconcile] could not enqueue llm-reply for ${r.id}: ${res.error}`,
        );
    }
  }

  if (list.length > 0) {
    console.log(
      `[reconcile] inbound-orphans found=${list.length} enqueued=${enqueued}`,
    );
  }

  return { found: list.length, enqueued };
}

/**
 * Drive blue-ticks + customer-name back-fill for messages that came in via
 * the reconciliation path (i.e. when the normal inbound-message worker
 * never ran). All errors are logged and swallowed so reply generation is
 * never blocked.
 */
async function postRoutingSideEffects(
  messageId: string,
  organizationId: string,
  conversationId: string,
): Promise<void> {
  try {
    const [conv] = await db
      .select({
        channelConnectionId: conversation.channelConnectionId,
        customerId: conversation.customerId,
      })
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1);
    if (!conv?.channelConnectionId) return;
    const sender = (await loadChannelConnection(conv.channelConnectionId))
      .sender;

    // Mark inbound as read (blue ticks)
    const [m] = await db
      .select({ providerMessageId: message.providerMessageId })
      .from(message)
      .where(eq(message.id, messageId))
      .limit(1);
    if (m?.providerMessageId) {
      await sender.markAsRead?.(m.providerMessageId);
      await sender.showTyping?.(m.providerMessageId);
    }

    // Back-fill customer.displayName if empty
    const [cust] = await db
      .select({
        id: customer.id,
        phoneE164: customer.phoneE164,
        displayName: customer.displayName,
      })
      .from(customer)
      .where(
        and(
          eq(customer.id, conv.customerId),
          eq(customer.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (
      cust &&
      !cust.displayName &&
      cust.phoneE164 &&
      !cust.phoneE164.startsWith("ext:") &&
      sender.fetchContactName
    ) {
      const fetched = await sender.fetchContactName(cust.phoneE164);
      if (fetched) {
        await db
          .update(customer)
          .set({ displayName: fetched, updatedAt: new Date() })
          .where(eq(customer.id, cust.id));
        console.log(
          `[reconcile] back-filled displayName="${fetched}" for ${cust.phoneE164}`,
        );
      }
    }
  } catch (e) {
    console.warn(
      "[reconcile] post-routing side effects failed:",
      (e as Error).message,
    );
  }
}
