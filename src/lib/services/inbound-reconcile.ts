import { sql } from "drizzle-orm";
import { db } from "@/db";
import { QUEUES, safeEnqueue, type LlmReplyJob } from "@/lib/queue";

/**
 * Self-healing pass for inbound messages that never got an AI reply.
 *
 * Why this exists:
 *   - The webhook (Amplify) inserts the inbound message into Postgres and
 *     then enqueues an `inbound-message` job to Redis. If Redis is briefly
 *     unreachable from the Lambda (cold-start blip, security group hiccup,
 *     etc.) the row is in DB but no job exists — the user never gets a reply.
 *   - The worker scans every minute for such "orphaned" inbound messages
 *     and directly enqueues an `llm-reply` job, bypassing the inbound-message
 *     queue entirely. The conversation is also confirmed to still be in
 *     `bot` mode (humans haven't taken over).
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
  }>(sql`
    WITH orphans AS (
      SELECT m.id, m.organization_id, m.conversation_id
      FROM message m
      JOIN conversation c ON c.id = m.conversation_id
      WHERE m.direction = 'inbound'
        AND m.created_at >= NOW() - interval '15 minutes'
        AND m.created_at <= NOW() - interval '20 seconds'
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
    RETURNING message.id, message.organization_id, message.conversation_id;
  `);

  const list: { id: string; organization_id: string; conversation_id: string }[] =
    Array.isArray(rows)
      ? (rows as unknown as {
          id: string;
          organization_id: string;
          conversation_id: string;
        }[])
      : ((rows as unknown as {
          rows?: {
            id: string;
            organization_id: string;
            conversation_id: string;
          }[];
        }).rows ?? []);

  let enqueued = 0;
  for (const r of list) {
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

  if (list.length > 0) {
    console.log(
      `[reconcile] inbound-orphans found=${list.length} enqueued=${enqueued}`,
    );
  }

  return { found: list.length, enqueued };
}
