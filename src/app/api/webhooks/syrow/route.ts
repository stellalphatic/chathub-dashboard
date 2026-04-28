import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { normalizeSyrowInbound } from "@/lib/providers/syrow";
import { QUEUES, safeEnqueue, type InboundMessageJob } from "@/lib/queue";
import { ingestInboundMessage } from "@/lib/services/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/syrow
 *
 * Two event types Syrow can fire to this URL:
 *   1. Standard WhatsApp inbound (Meta-style payload). Goes through the
 *      regular ingest pipeline → llm-reply.
 *   2. AI Action Data Submission (form fills via Syrow's AI flows). We
 *      log them as a system note on the customer (best-effort) but they
 *      don't trigger a bot reply.
 *
 * Verification:
 *   - If `SYROW_WEBHOOK_SECRET` env is set, we expect either:
 *       a) `X-Syrow-Signature: sha256=<hex>` HMAC over the raw body, OR
 *       b) `X-Webhook-Secret: <secret>` header (constant-time compare).
 *     Whichever the operator chose to configure in their Syrow dashboard.
 *   - Without `SYROW_WEBHOOK_SECRET` set, we accept all (development).
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.SYROW_WEBHOOK_SECRET;
  if (secret) {
    const sigHeader = request.headers.get("x-syrow-signature");
    const flatHeader = request.headers.get("x-webhook-secret");
    let ok = false;
    if (sigHeader) {
      ok = verifyHmac(raw, sigHeader, secret);
    } else if (flatHeader) {
      ok = constantTimeEq(flatHeader, secret);
    }
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

  // Light debug log — first 1500 chars of the raw payload so we can see
  // exactly what shape Syrow is delivering.
  console.log(
    "[syrow webhook] payload",
    raw.length > 1500 ? raw.slice(0, 1500) + "…" : raw,
  );

  // AI Action Data Submission — this isn't an inbound chat message, it's
  // a form fill from the Syrow widget. We respond 200 OK so Syrow doesn't
  // retry; eventually we'll persist these as customer profile updates.
  if (payload["identifier"] && payload["data"]) {
    console.log(
      "[syrow webhook] AI-Action submission (logged, not yet ingested):",
      JSON.stringify(payload).slice(0, 800),
    );
    return NextResponse.json({ ok: true, kind: "ai-action" });
  }

  const messages = normalizeSyrowInbound(payload);
  let enqueued = 0;
  for (const m of messages) {
    try {
      const ingested = await ingestInboundMessage({ m });
      if (!ingested || ingested.duplicate) continue;
      const job: InboundMessageJob = {
        organizationId: ingested.organizationId,
        channelConnectionId: ingested.channelConnectionId,
        channel: ingested.channel as InboundMessageJob["channel"],
        provider: "syrow",
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
      const r = await safeEnqueue(QUEUES.inboundMessage, job, {
        jobId: `in:${m.provider}:${m.externalMessageId}`,
      });
      if (r.ok) enqueued++;
    } catch (e) {
      console.error("[syrow webhook]", e);
    }
  }

  return NextResponse.json({ ok: true, enqueued });
}

/** GET handshake (Syrow dashboard often pings to validate the URL). */
export async function GET() {
  return NextResponse.json({ ok: true, service: "chathub-syrow-webhook" });
}

function verifyHmac(
  raw: string,
  header: string,
  secret: string,
): boolean {
  const sig = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return timingSafeEqual(ab, bb);
}
