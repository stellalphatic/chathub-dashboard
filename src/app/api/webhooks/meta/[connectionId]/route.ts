import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { channelConnection } from "@/db/schema";
import { decryptJSON } from "@/lib/encryption";
import {
  normalizeMetaInbound,
  verifyMetaSignature,
} from "@/lib/providers/meta";
import { QUEUES, safeEnqueue, type InboundMessageJob } from "@/lib/queue";
import { ingestInboundMessage } from "@/lib/services/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-business Meta webhook (Instagram + Messenger direct).
 *
 * URL pattern:
 *   GET/POST /api/webhooks/meta/{channelConnectionId}
 *
 * Why per-business:
 *   In our SaaS each onboarded business brings their OWN Meta app — so the
 *   verify token + app secret are unique per business. We give each
 *   channel_connection a unique URL + a per-row `webhookSecret` (verify
 *   token) and read the `appSecret` from its encrypted secrets blob.
 *
 *   - GET handshake (Meta subscribes)
 *       hub.verify_token  matches  channel_connection.webhookSecret  → echo
 *       hub.challenge as plain text. Otherwise 403.
 *
 *   - POST event (Meta delivers IG / FB messaging events)
 *       X-Hub-Signature-256  verifies against secrets.appSecret of THIS
 *       channel_connection. Each business's signatures are validated
 *       against their own app's secret — no cross-tenant leaks.
 */

async function loadConnection(connectionId: string) {
  const [row] = await db
    .select()
    .from(channelConnection)
    .where(eq(channelConnection.id, connectionId))
    .limit(1);
  return row ?? null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await context.params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verify = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const conn = await loadConnection(connectionId);
  if (!conn) {
    console.warn(
      `[meta webhook GET] unknown connectionId=${connectionId}`,
    );
    return new NextResponse("not found", { status: 404 });
  }
  if (conn.provider !== "meta") {
    return new NextResponse("forbidden", { status: 403 });
  }

  if (
    mode === "subscribe" &&
    verify &&
    conn.webhookSecret &&
    verify === conn.webhookSecret
  ) {
    console.log(
      `[meta webhook GET] verified connectionId=${connectionId} channel=${conn.channel}`,
    );
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  console.warn(
    `[meta webhook GET] verify failed connectionId=${connectionId}`,
  );
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await context.params;
  const raw = await request.text();

  const conn = await loadConnection(connectionId);
  if (!conn || conn.provider !== "meta") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Decrypt + verify signature against THIS business's appSecret.
  let appSecret: string | undefined;
  if (conn.secretsCiphertext) {
    try {
      const dec = decryptJSON<{ appSecret?: string }>(conn.secretsCiphertext);
      appSecret = dec?.appSecret;
    } catch (e) {
      console.warn(
        "[meta webhook POST] decrypt failed:",
        (e as Error).message,
      );
    }
  }
  // Fall back to platform-wide env (for legacy single-tenant setups + dev).
  if (!appSecret) appSecret = process.env.META_APP_SECRET;

  if (appSecret) {
    const ok = verifyMetaSignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    );
    if (!ok) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  } else {
    console.warn(
      `[meta webhook POST] connection=${connectionId} has no app secret — accepting unsigned`,
    );
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
      const ingested = await ingestInboundMessage({
        m,
        forcedChannelConnectionId: connectionId,
      });
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
      console.error("[meta webhook POST]", e);
    }
  }

  return NextResponse.json({ ok: true, enqueued });
}
