import { NextResponse } from "next/server";
import {
  normalizeMetaInbound,
  verifyMetaSignature,
} from "@/lib/providers/meta";
import { QUEUES, safeEnqueue, type InboundMessageJob } from "@/lib/queue";
import { ingestInboundMessage } from "@/lib/services/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/meta  — Meta's verification handshake (hub.challenge).
 *   Set META_VERIFY_TOKEN to the same token configured in the Meta app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verify = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    verify &&
    verify === (process.env.META_VERIFY_TOKEN ?? "")
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/**
 * POST /api/webhooks/meta
 *
 * Handles Instagram DMs AND Facebook Messenger page messages (one endpoint,
 * different `object` value in the payload). Signature verified with
 * META_APP_SECRET against the raw body.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const ok = verifyMetaSignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    );
    if (!ok) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const messages = normalizeMetaInbound(payload);
  let enqueued = 0;
  for (const m of messages) {
    try {
      const ingested = await ingestInboundMessage({ m });
      if (!ingested || ingested.duplicate) continue;
      const job: InboundMessageJob = {
        organizationId: ingested.organizationId,
        channelConnectionId: ingested.channelConnectionId,
        channel: ingested.channel as InboundMessageJob["channel"],
        provider: "meta",
        externalMessageId: m.externalMessageId,
        fromPhoneE164: m.fromPhoneE164,
        fromExternalId: m.fromExternalId,
        displayName: m.displayName,
        contentType: m.contentType,
        body: m.body,
        mediaUrl: m.mediaUrl,
        mediaMimeType: m.mediaMimeType,
        raw: m.raw,
        receivedAt: m.receivedAt,
      };
      await safeEnqueue(QUEUES.inboundMessage, job, {
        jobId: `in:${m.provider}:${m.externalMessageId}`,
      });
      enqueued++;
    } catch (e) {
      console.error("[meta webhook]", e);
    }
  }

  return NextResponse.json({ ok: true, enqueued });
}
