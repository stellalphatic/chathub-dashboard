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
}
