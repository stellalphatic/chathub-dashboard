import { createHmac, timingSafeEqual } from "crypto";
import type {
  ChannelSender,
  NormalizedInboundMessage,
  SendResult,
  SendTextInput,
} from "./types";

/**
 * Meta Graph API adapter for Instagram DMs and Facebook Messenger (direct).
 *
 * Secrets: { accessToken: string; appSecret?: string }
 *   - `accessToken` — long-lived Page access token (required for sends).
 *   - `appSecret` — App Secret from Meta → Settings → Basic (same secret Meta
 *     uses for `X-Hub-Signature-256` on webhooks). Stored per connection; the
 *     legacy platform env `META_APP_SECRET` is only a fallback for `/api/webhooks/meta`.
 *
 * Config:
 *   - Instagram: { igUserId: string }  — Instagram Business Account ID used in `/{id}/messages`.
 *   - Messenger: { pageId: string }
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaSecrets = {
  accessToken: string;
  appSecret?: string;
};

export type MetaIgConfig = {
  igUserId: string;
};
export type MetaFbConfig = {
  pageId: string;
};

async function postMeta(
  path: string,
  accessToken: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const url = `${GRAPH}${path}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`meta ${path} ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export function createInstagramSender(
  secrets: MetaSecrets,
  config: MetaIgConfig,
): ChannelSender {
  return {
    async sendText(input: SendTextInput): Promise<SendResult> {
      if (!input.toExternalId) {
        throw new Error("Instagram sendText requires toExternalId (IG-scoped ID)");
      }
      const json = await postMeta(
        `/${config.igUserId}/messages`,
        secrets.accessToken,
        {
          recipient: { id: input.toExternalId },
          message: { text: input.body },
        },
      );
      const id = String(json["message_id"] ?? json["id"] ?? "");
      return { providerMessageId: id || `ig-${Date.now()}`, raw: json };
    },
  };
}

export function createMessengerSender(
  secrets: MetaSecrets,
  config: MetaFbConfig,
): ChannelSender {
  return {
    async sendText(input: SendTextInput): Promise<SendResult> {
      if (!input.toExternalId) {
        throw new Error("Messenger sendText requires toExternalId (PSID)");
      }
      const json = await postMeta(
        `/${config.pageId}/messages`,
        secrets.accessToken,
        {
          recipient: { id: input.toExternalId },
          messaging_type: "RESPONSE",
          message: { text: input.body },
        },
      );
      const id = String(json["message_id"] ?? json["id"] ?? "");
      return { providerMessageId: id || `fb-${Date.now()}`, raw: json };
    },
  };
}

/** Validate X-Hub-Signature-256 header against raw body. */
export function verifyMetaSignature(
  rawBody: string,
  headerValue: string | null,
  appSecret: string,
): boolean {
  if (!headerValue) return false;
  const [algo, sig] = headerValue.split("=");
  if (algo !== "sha256" || !sig) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Normalize Meta webhook payload for IG + Messenger.
 * Both share { object, entry: [...] } shape with per-channel messaging events.
 */
export function normalizeMetaInbound(
  payload: Record<string, unknown>,
): NormalizedInboundMessage[] {
  const out: NormalizedInboundMessage[] = [];
  const now = Date.now();
  const obj = String(payload["object"] ?? "");
  const entries = (payload["entry"] as Array<Record<string, unknown>>) ?? [];

  for (const e of entries) {
    const messaging = (e["messaging"] as Array<Record<string, unknown>>) ?? [];
    const pageOrIgId = String(e["id"] ?? "");
    for (const m of messaging) {
      // Skip echoes (our own sends reflected back).
      const msg = m["message"] as
        | {
            mid?: string;
            text?: string;
            is_echo?: boolean;
            attachments?: Array<{
              type?: string;
              payload?: { url?: string };
            }>;
          }
        | undefined;
      if (!msg || msg.is_echo) continue;

      const sender = (m["sender"] as { id?: string } | undefined)?.id;
      const id = String(msg.mid ?? `meta-${now}-${Math.random()}`);
      const body = msg.text ?? "";
      const att = msg.attachments?.[0];
      const channel: NormalizedInboundMessage["channel"] =
        obj === "instagram" ? "instagram" : "messenger";
      let contentType: NormalizedInboundMessage["contentType"] = "text";
      let mediaUrl: string | undefined;
      if (att?.type) {
        mediaUrl = att.payload?.url;
        if (att.type === "audio") contentType = "voice_note";
        else if (att.type === "image") contentType = "image";
        else if (att.type === "video") contentType = "video";
        else if (att.type === "file") contentType = "document";
      }
      out.push({
        provider: "meta",
        channel,
        externalMessageId: id,
        fromExternalId: sender,
        contentType,
        body,
        mediaUrl,
        receivedAt: now,
        channelExternalId: pageOrIgId,
        raw: m,
      });
    }
  }

  return out;
}
