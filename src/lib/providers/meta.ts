import { createHmac, timingSafeEqual } from "crypto";
import {
  fetchInstagramLoginParticipant,
  fetchInstagramScopedParticipant,
  resolveInstagramPageAccessToken,
} from "./meta-resolve";
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
 *   - Instagram: { igUserId, messagingGraph? }
 *       - `messagingGraph: "facebook"` (default): Page access token on **graph.facebook.com**
 *         (Messenger Platform + linked Page / IG).
 *       - `messagingGraph: "instagram"`: **Instagram User** access token on **graph.instagram.com**
 *         ([Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/)).
 *         Using a Facebook-only token on `graph.facebook.com` often yields OAuth **190 Cannot parse access token**.
 *   - Messenger: { pageId: string }
 */

const GRAPH_FB = "https://graph.facebook.com/v21.0";
const GRAPH_IG = "https://graph.instagram.com/v21.0";

export type MetaSecrets = {
  accessToken: string;
  appSecret?: string;
};

export type InstagramMessagingGraph = "facebook" | "instagram";

export type MetaIgConfig = {
  igUserId: string;
  /** Omit or `facebook` = Page token on graph.facebook.com; `instagram` = Instagram user token on graph.instagram.com */
  messagingGraph?: InstagramMessagingGraph;
};
export type MetaFbConfig = {
  pageId: string;
};

async function postMessengerFacebook(
  path: string,
  accessToken: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const url = `${GRAPH_FB}${path}?access_token=${encodeURIComponent(accessToken)}`;
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

async function postInstagramDm(
  igUserId: string,
  accessToken: string,
  body: unknown,
  graph: InstagramMessagingGraph,
): Promise<Record<string, unknown>> {
  const path = `/${igUserId}/messages`;
  if (graph === "instagram") {
    const url = `${GRAPH_IG}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`meta instagram ${path} ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }
  const url = `${GRAPH_FB}${path}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`meta facebook ${path} ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function instagramContactLabelFromPhoneKey(
  secrets: MetaSecrets,
  config: MetaIgConfig,
  phoneE164: string,
): Promise<string | undefined> {
  const m = /^ext:instagram:(.+)$/.exec(phoneE164.trim());
  const sid = m?.[1]?.trim() ?? "";
  if (!sid) return undefined;
  const graph: InstagramMessagingGraph = config.messagingGraph ?? "facebook";
  if (graph === "instagram") {
    const part = await fetchInstagramLoginParticipant(secrets.accessToken, sid);
    return part?.label ?? undefined;
  }
  const pageTok = await resolveInstagramPageAccessToken(
    secrets.accessToken,
    config.igUserId,
  );
  const tok = (pageTok ?? secrets.accessToken).trim();
  const part = await fetchInstagramScopedParticipant(tok, sid);
  return part?.label ?? undefined;
}

export function createInstagramSender(
  secrets: MetaSecrets,
  config: MetaIgConfig,
): ChannelSender {
  const graph: InstagramMessagingGraph = config.messagingGraph ?? "facebook";
  return {
    async fetchContactName(phoneE164: string): Promise<string | undefined> {
      try {
        return await instagramContactLabelFromPhoneKey(secrets, config, phoneE164);
      } catch {
        return undefined;
      }
    },
    async sendText(input: SendTextInput): Promise<SendResult> {
      if (!input.toExternalId) {
        throw new Error("Instagram sendText requires toExternalId (IG-scoped ID)");
      }
      const json = await postInstagramDm(
        config.igUserId,
        secrets.accessToken,
        {
          recipient: { id: input.toExternalId },
          message: { text: input.body },
        },
        graph,
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
      const json = await postMessengerFacebook(
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
