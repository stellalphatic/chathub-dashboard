import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { normalizeYCloudInbound } from "@/lib/providers/ycloud";
import { QUEUES, safeEnqueue, type InboundMessageJob } from "@/lib/queue";
import { ingestInboundMessage } from "@/lib/services/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/ycloud
 *
 * Verification: YCloud signs each webhook as `X-YCloud-Signature: sha256=<hex>`
 * over the raw request body using the per-app webhook secret
 * (YCLOUD_WEBHOOK_SECRET env). If set, we require a valid signature.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  const signature = request.headers.get("x-ycloud-signature");
  const secret = process.env.YCLOUD_WEBHOOK_SECRET;
  if (secret) {
    const ok = verifySignature(raw, signature, secret);
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

  // Lightweight debug log — type, top-level keys, first 1000 chars of
  // payload. Status updates are common and we don't ingest them, so we
  // tag the log with `inbound=true|false` to make CloudWatch readable.
  const evType = String(payload["type"] ?? "");
  const inner = (payload["whatsappMessage"] ?? payload["whatsappInboundMessage"]) as
    | Record<string, unknown>
    | undefined;
  const status = inner ? String(inner["status"] ?? "") : "";
  const isStatusUpdate =
    evType.endsWith(".updated") ||
    ["sent", "delivered", "read", "failed"].includes(status);
  console.log(
    `[ycloud webhook] type=${evType} status=${status || "-"} inbound=${!isStatusUpdate}`,
    raw.length > 1500 ? raw.slice(0, 1500) + "…" : raw,
  );

  const messages = normalizeYCloudInbound(payload);
  let enqueued = 0;
  for (const m of messages) {
    try {
      const ingested = await ingestInboundMessage({ m });
      if (!ingested || ingested.duplicate) continue;

      const job: InboundMessageJob = {
        organizationId: ingested.organizationId,
        channelConnectionId: ingested.channelConnectionId,
        channel: ingested.channel as InboundMessageJob["channel"],
        provider: "ycloud",
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
      // safeEnqueue: if Redis is briefly unreachable we still acknowledge
      // YCloud — the row is in Postgres and the worker's reconciliation pass
      // will pick it up. Returning 500 here causes YCloud to retry forever.
      const r = await safeEnqueue(QUEUES.inboundMessage, job, {
        jobId: `in:${m.provider}:${m.externalMessageId}`,
      });
      if (r.ok) enqueued++;
    } catch (e) {
      console.error("[ycloud webhook]", e);
    }
  }

  return NextResponse.json({ ok: true, enqueued });
}

/** YCloud also pings with GET for verification on some setups. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "chathub-ycloud-webhook" });
}

function verifySignature(
  raw: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const sig = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
