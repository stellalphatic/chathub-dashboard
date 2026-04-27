import type { Job } from "bullmq";
import {
  enqueue,
  QUEUES,
  type InboundMessageJob,
  type LlmReplyJob,
  type MediaArchiveJob,
  type VoiceTranscribeJob,
} from "../../src/lib/queue";
import { db } from "../../src/db";
import { eq } from "drizzle-orm";
import { conversation, message } from "../../src/db/schema";
import { isS3Configured } from "../../src/lib/media/s3";
import { loadChannelConnection } from "../../src/lib/providers/sender-factory";
import { orgLlmRateLimit } from "../../src/lib/rate-limit";

/**
 * Route an inbound message. Voice notes branch to transcription first;
 * text messages (or voice once transcribed) go to llm-reply.
 *
 * Because the row already exists in DB (the webhook inserted it via
 * ingestInboundMessage), we only need to trigger downstream work.
 */
export async function handleInboundMessage(job: Job<InboundMessageJob>) {
  const p = job.data;

  // Find the message row by provider id.
  const [row] = await db
    .select({
      id: message.id,
      conversationId: message.conversationId,
      contentType: message.contentType,
      mediaUrl: message.mediaUrl,
      mediaMimeType: message.mediaMimeType,
    })
    .from(message)
    .where(eq(message.providerMessageId, p.externalMessageId))
    .limit(1);

  if (!row) {
    console.warn("[inbound] message row missing for", p.externalMessageId);
    return;
  }
  if (!row.conversationId) return;

  // Best-effort: drive WhatsApp blue ticks + typing indicator immediately
  // so the customer sees activity while we generate the reply. Also try to
  // back-fill the customer.displayName from the provider's contacts API if
  // the webhook didn't include profile.name. All wrapped so failures never
  // block reply generation.
  if (p.channel === "whatsapp" && p.externalMessageId) {
    void (async () => {
      try {
        const conn = await loadChannelConnection(p.channelConnectionId);
        await conn.sender.markAsRead?.(p.externalMessageId);
        await conn.sender.showTyping?.(p.externalMessageId);

        // Late-bind name if missing.
        if (p.fromPhoneE164 && conn.sender.fetchContactName) {
          // Only try if we don't already have a name on the customer row.
          const { customer } = await import("../../src/db/schema");
          const { and: andOp, eq: eqOp } = await import("drizzle-orm");
          const [cust] = await db
            .select({ id: customer.id, displayName: customer.displayName })
            .from(customer)
            .where(
              andOp(
                eqOp(customer.organizationId, p.organizationId),
                eqOp(customer.phoneE164, p.fromPhoneE164),
              ),
            )
            .limit(1);
          if (cust && !cust.displayName) {
            const fetched = await conn.sender.fetchContactName(
              p.fromPhoneE164,
            );
            if (fetched) {
              await db
                .update(customer)
                .set({ displayName: fetched, updatedAt: new Date() })
                .where(eqOp(customer.id, cust.id));
              console.log(
                `[inbound] back-filled displayName="${fetched}" for ${p.fromPhoneE164}`,
              );
            }
          }
        }
      } catch (e) {
        console.warn(
          "[inbound] markAsRead/typing/fetchName failed:",
          (e as Error).message,
        );
      }
    })();
  }

  // Mirror provider CDN media to our S3 bucket (fire-and-forget — retries via BullMQ).
  if (row.mediaUrl && isS3Configured()) {
    const archiveJob: MediaArchiveJob = {
      organizationId: p.organizationId,
      messageId: row.id,
    };
    await enqueue(QUEUES.mediaArchive, archiveJob, { jobId: `arch:${row.id}` });
  }

  // Check conversation mode. If human is handling it, don't bot-reply.
  const [conv] = await db
    .select({ mode: conversation.mode })
    .from(conversation)
    .where(eq(conversation.id, row.conversationId))
    .limit(1);
  if (!conv) return;

  if (row.contentType === "voice_note") {
    // Branch: transcribe first.
    if (row.mediaUrl) {
      const vj: VoiceTranscribeJob = {
        organizationId: p.organizationId,
        messageId: row.id,
        mediaUrl: row.mediaUrl,
        mediaMimeType: row.mediaMimeType ?? undefined,
      };
      await enqueue(QUEUES.voiceTranscribe, vj, {
        jobId: `vt:${row.id}`,
      });
    }
    return;
  }

  if (conv.mode !== "bot") {
    // Human is driving — nothing to do here. The inbox UI will pick it up.
    return;
  }

  // LLM rate-limit guard at the org level.
  const rl = await orgLlmRateLimit(p.organizationId);
  if (!rl.allowed) {
    // Delay 15s and retry.
    throw new Error("org llm rate limit");
  }

  const j: LlmReplyJob = {
    organizationId: p.organizationId,
    conversationId: row.conversationId,
    triggeringMessageId: row.id,
  };
  await enqueue(QUEUES.llmReply, j, { jobId: `llm:${row.id}` });

  // Stamp so the reconciliation pass knows this message was already routed.
  await db
    .update(message)
    .set({ inboundReconciledAt: new Date() })
    .where(eq(message.id, row.id));
}
