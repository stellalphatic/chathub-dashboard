import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { normalizeManyChatInbound } from "@/lib/providers/manychat";
import { enqueue, QUEUES, type InboundMessageJob } from "@/lib/queue";
import { ingestInboundMessage } from "@/lib/services/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/manychat
 *
 * ManyChat doesn't sign its outgoing "External Request" calls. So we require
 * the flow owner to add a custom header `x-chathub-secret: <MANYCHAT_WEBHOOK_SECRET>`
 * when wiring the trigger. If the env var is unset we accept everything
 * (dev-only).
 */
export async function POST(request: Request) {
  const expected = process.env.MANYCHAT_WEBHOOK_SECRET;
  if (expected) {
    const got = request.headers.get("x-chathub-secret") ?? "";
    if (!safeEqual(expected, got)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const messages = normalizeManyChatInbound(payload);
  let enqueued = 0;
  for (const m of messages) {
    try {
      const ingested = await ingestInboundMessage({ m });
      if (!ingested || ingested.duplicate) continue;
      const job: InboundMessageJob = {
        organizationId: ingested.organizationId,
        channelConnectionId: ingested.channelConnectionId,
        channel: ingested.channel as InboundMessageJob["channel"],
        provider: "manychat",
        externalMessageId: m.externalMessageId,
        fromExternalId: m.fromExternalId,
        displayName: m.displayName,
        contentType: m.contentType,
        body: m.body,
        raw: m.raw,
        receivedAt: m.receivedAt,
      };
      await enqueue(QUEUES.inboundMessage, job, {
        jobId: `in:${m.provider}:${m.externalMessageId}`,
      });
      enqueued++;
    } catch (e) {
      console.error("[manychat webhook]", e);
    }
  }

  return NextResponse.json({ ok: true, enqueued });
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
