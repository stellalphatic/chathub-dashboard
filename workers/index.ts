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
import { cleanupLegacyTickerRepeatables, QUEUES } from "../src/lib/queue";
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
    // NOTE: we deliberately do NOT register a BullMQ Worker for
    // QUEUES.scheduledTicker — see the setInterval loop below. BullMQ
    // repeatables were hitting a "Received an instance of Date"
    // serialization bug in 5.x, so we bypass Redis entirely for this tick.
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

  // One-time cleanup of any broken BullMQ repeatables from past deploys.
  await cleanupLegacyTickerRepeatables();

  // In-process minute tick — uses the same handler as the old BullMQ
  // repeatable, but driven by setInterval. Two worker replicas will each
  // tick; `FOR UPDATE SKIP LOCKED` in the SQL ensures we never double-send.
  const TICK_EVERY_MS = 60_000;
  const tick = async () => {
    try {
      await handleScheduledTicker();
    } catch (e) {
      console.error("[scheduled-ticker] in-process tick failed:", e);
    }
  };
  const tickerHandle = setInterval(tick, TICK_EVERY_MS);
  // Run one immediately on boot so late-scheduled messages don't wait a full minute.
  void tick();

  console.log("[worker] ready; scheduled-ticker running every 60s in-process");

  const shutdown = async (sig: string) => {
    console.log(`[worker] ${sig} — shutting down`);
    clearInterval(tickerHandle);
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
