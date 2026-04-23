/**
 * Worker entrypoint. Runs all BullMQ workers in a single Node process.
 *
 *   npm run worker            # local (reads .env.local)
 *   npm run worker:prod       # docker / pm2 (expects env in process)
 *
 * This process is stateless — scale horizontally by running N copies behind
 * a shared Redis. Graceful shutdown on SIGTERM/SIGINT.
 */

import { Worker } from "bullmq";
import { buildBullConnection } from "../src/lib/redis";
import { ensureRepeatables, QUEUES } from "../src/lib/queue";
import { handleInboundMessage } from "./handlers/inbound-message";
import { handleOutboundSend } from "./handlers/outbound-send";
import { handleLlmReply } from "./handlers/llm-reply";
import { handleEmbedDocument } from "./handlers/embed-document";
import { handleScheduledTicker } from "./handlers/scheduled-ticker";
import { handleBroadcastRunner } from "./handlers/broadcast-runner";
import { handleVoiceTranscribe } from "./handlers/voice-transcribe";
import { handleMediaArchive } from "./handlers/media-archive";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 10);

async function main() {
  console.log("[worker] starting with concurrency", CONCURRENCY);

  const workers = [
    new Worker(QUEUES.inboundMessage, handleInboundMessage, {
      connection: buildBullConnection(),
      concurrency: CONCURRENCY,
    }),
    new Worker(QUEUES.outboundSend, handleOutboundSend, {
      connection: buildBullConnection(),
      concurrency: CONCURRENCY,
    }),
    new Worker(QUEUES.llmReply, handleLlmReply, {
      connection: buildBullConnection(),
      concurrency: Math.max(4, Math.floor(CONCURRENCY / 2)),
    }),
    new Worker(QUEUES.embedDocument, handleEmbedDocument, {
      connection: buildBullConnection(),
      concurrency: 2,
    }),
    new Worker(QUEUES.scheduledTicker, handleScheduledTicker, {
      connection: buildBullConnection(),
      concurrency: 1,
    }),
    new Worker(QUEUES.broadcastRunner, handleBroadcastRunner, {
      connection: buildBullConnection(),
      concurrency: 2,
    }),
    new Worker(QUEUES.voiceTranscribe, handleVoiceTranscribe, {
      connection: buildBullConnection(),
      concurrency: 4,
    }),
    new Worker(QUEUES.mediaArchive, handleMediaArchive, {
      connection: buildBullConnection(),
      concurrency: 4,
    }),
  ];

  for (const w of workers) {
    w.on("completed", (job) => {
      console.log(`[worker:${w.name}] completed ${job.id}`);
    });
    w.on("failed", (job, err) => {
      console.error(
        `[worker:${w.name}] failed ${job?.id}: ${err?.message}`,
      );
    });
  }

  await ensureRepeatables();
  console.log("[worker] repeatables ensured; waiting for jobs…");

  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} — shutting down`);
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
