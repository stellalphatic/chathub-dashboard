import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { conversation, message } from "../../src/db/schema";
import {
  enqueue,
  QUEUES,
  type LlmReplyJob,
  type VoiceTranscribeJob,
} from "../../src/lib/queue";
import { transcribeAudio } from "../../src/lib/voice";

type ConvMetadata = Record<string, unknown> & {
  lastInboundLanguage?: string;
  lastInboundLanguageDetectedAt?: string;
};

/**
 * Transcribe a voice-note inbound message and then trigger the LLM reply.
 * We store the transcript in `message.transcript` and also mirror it to
 * `message.body` so the bot (which reads `body`) sees the text naturally.
 */
export async function handleVoiceTranscribe(job: Job<VoiceTranscribeJob>) {
  const p = job.data;

  const [row] = await db
    .select({
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
    })
    .from(message)
    .where(eq(message.id, p.messageId))
    .limit(1);
  if (!row) return { error: "message missing" };

  try {
    const t = await transcribeAudio({
      mediaUrl: p.mediaUrl,
      organizationId: p.organizationId,
      // Don't pass preferredLanguage — it'll auto-resolve from per-org
      // bot_config.transcriptionLanguage (or "auto" for code-switched audio).
    });
    const text = (t.text ?? "").trim();
    await db
      .update(message)
      .set({
        transcript: text,
        body: text || row.body,
      })
      .where(eq(message.id, row.id));

    if (row.conversationId) {
      // Persist the detected language onto conversation.metadata so the
      // LLM knows what the customer just spoke and can reply in the same
      // language + script. Whisper returns a 2-letter code (en/ur/hi/...).
      const [conv] = await db
        .select({
          mode: conversation.mode,
          metadata: conversation.metadata,
        })
        .from(conversation)
        .where(eq(conversation.id, row.conversationId))
        .limit(1);

      if (conv && t.language) {
        const meta: ConvMetadata = (conv.metadata as ConvMetadata) ?? {};
        meta.lastInboundLanguage = t.language;
        meta.lastInboundLanguageDetectedAt = new Date().toISOString();
        await db
          .update(conversation)
          .set({ metadata: meta, updatedAt: new Date() })
          .where(eq(conversation.id, row.conversationId));
      }

      if (conv?.mode === "bot" && text) {
        const j: LlmReplyJob = {
          organizationId: p.organizationId,
          conversationId: row.conversationId,
          triggeringMessageId: row.id,
        };
        await enqueue(QUEUES.llmReply, j, { jobId: `llm:${row.id}` });
      }
    }
    return { ok: true, provider: t.provider, language: t.language };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await db
      .update(message)
      .set({ failureReason: err })
      .where(eq(message.id, row.id));
    throw e;
  }
}
