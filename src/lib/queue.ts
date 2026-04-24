import { Queue, type JobsOptions, QueueEvents } from "bullmq";
import { buildBullConnection } from "./redis";

/**
 * Queue names — import these from here, never hardcode strings.
 * Keep them small and specific. Each queue gets its own Worker in /workers.
 */
export const QUEUES = {
  /** Inbound normalized message → LLM pipeline. Fast, high volume. */
  inboundMessage: "inbound-message",
  /** Send a message on a provider channel (WhatsApp/IG/FB). */
  outboundSend: "outbound-send",
  /** Generate assistant reply with RAG + guardrails. Separate queue for throughput control. */
  llmReply: "llm-reply",
  /** Parse+chunk+embed a newly uploaded document. */
  embedDocument: "embed-document",
  /** Fire a scheduled_message when its runAt passes. Repeatable cron tick. */
  scheduledTicker: "scheduled-ticker",
  /** Run a broadcast — expand audience, enqueue per-customer sends. */
  broadcastRunner: "broadcast-runner",
  /** Voice transcription worker. */
  voiceTranscribe: "voice-transcribe",
  /** Mirror provider CDN media (WhatsApp/Meta) to our S3 bucket. */
  mediaArchive: "media-archive",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Shared connection factory — each Queue/Worker instance gets its own conn
// because BullMQ doesn't share subscribers for blocking commands.

const _queues = new Map<QueueName, Queue>();

export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  const existing = _queues.get(name);
  if (existing) return existing as Queue<T>;
  const q = new Queue<T>(name, {
    connection: buildBullConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { age: 24 * 3600, count: 5_000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 10_000 },
    },
  });
  _queues.set(name, q);
  return q as Queue<T>;
}

export async function enqueue<T>(
  name: QueueName,
  payload: T,
  opts?: JobsOptions & { jobId?: string },
) {
  const q = getQueue<T>(name);
  // BullMQ generics tie job name + data to internal Extract* helpers; we always enqueue typed payloads by queue id.
  return (q as unknown as Queue).add(name, payload, opts);
}

/** Repeatable ticker: scheduled message scanner runs every minute.
 *
 * We use `every: 60_000` (interval in ms) instead of a cron `pattern`.
 * BullMQ 5.x had a serialization bug with cron-pattern repeats where the
 * next-run Date object reached Redis as-is, throwing
 * "Received an instance of Date". Interval-based repeats take a different
 * code path and are not affected.
 */
export async function ensureRepeatables() {
  const ticker = getQueue(QUEUES.scheduledTicker);

  // Clean up any old cron-pattern-based repeat from previous deploys so we
  // don't accumulate stale, broken repeatables in Redis.
  try {
    const existing = await ticker.getRepeatableJobs();
    for (const r of existing) {
      if (r.name === "tick") {
        await ticker.removeRepeatableByKey(r.key);
      }
    }
  } catch {
    // First-run Redis may not have anything to clean — safe to ignore.
  }

  await ticker.add(
    "tick",
    { ts: Date.now() },
    {
      repeat: { every: 60_000 },
      jobId: "scheduled-ticker-repeat",
      removeOnComplete: true,
      removeOnFail: { count: 50 },
    },
  );
}

let _events: QueueEvents | null = null;
export function getInboundEvents() {
  if (_events) return _events;
  _events = new QueueEvents(QUEUES.inboundMessage, {
    connection: buildBullConnection(),
  });
  return _events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Job payload types (single source of truth)
// ─────────────────────────────────────────────────────────────────────────────

export type InboundMessageJob = {
  organizationId: string;
  channelConnectionId: string;
  channel: "whatsapp" | "instagram" | "messenger" | "sms" | "voice";
  provider: "ycloud" | "manychat" | "meta" | "twilio" | "vonage";
  externalMessageId: string;
  fromPhoneE164?: string;
  fromExternalId?: string; // ig/fb id
  displayName?: string;
  contentType: "text" | "image" | "audio" | "video" | "document" | "voice_note";
  body: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  raw: Record<string, unknown>;
  receivedAt: number;
};

export type OutboundSendJob = {
  organizationId: string;
  conversationId: string;
  messageId: string; // our DB id
  // When set, this is a template send (required after 24h window).
  templateId?: string;
  templateVariables?: Record<string, string>;
};

export type LlmReplyJob = {
  organizationId: string;
  conversationId: string;
  triggeringMessageId: string;
};

export type EmbedDocumentJob = {
  organizationId: string;
  documentId: string;
};

export type BroadcastRunnerJob = {
  organizationId: string;
  broadcastId: string;
};

export type VoiceTranscribeJob = {
  organizationId: string;
  messageId: string;
  mediaUrl: string;
  mediaMimeType?: string;
};

export type MediaArchiveJob = {
  organizationId: string;
  messageId: string;
  /** Optional bearer header if provider requires auth to fetch media. */
  authHeader?: string;
};
