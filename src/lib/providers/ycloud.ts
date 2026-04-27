import type {
  ChannelSender,
  NormalizedInboundMessage,
  SendResult,
  SendTemplateInput,
  SendTextInput,
} from "./types";

/**
 * YCloud WhatsApp Business API adapter.
 * Docs: https://www.ycloud.com/docs/api
 *
 * Secrets stored in channel_connection.secretsCiphertext:
 *   { apiKey: string; wabaId?: string }
 *
 * config (plaintext):
 *   { fromPhoneE164: string; phoneNumberId?: string }
 *
 * Webhook signature: YCloud signs with HMAC-SHA256 of the raw body using the
 * webhook secret, sent in `X-YCloud-Signature: sha256=<hex>`. We also accept
 * a shared-secret query/header `x-ychathub` as a fallback if the signature
 * field is missing on older accounts.
 */

export type YCloudSecrets = {
  apiKey: string;
  wabaId?: string;
};

export type YCloudConfig = {
  fromPhoneE164: string;
};

const BASE = "https://api.ycloud.com/v2";

export function createYCloudSender(
  secrets: YCloudSecrets,
  config: YCloudConfig,
): ChannelSender {
  async function post(path: string, body: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "x-api-key": secrets.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ycloud ${path} ${res.status}: ${text}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  return {
    /**
     * Mark an inbound message as read on WhatsApp (drives blue ticks).
     * YCloud follows Meta's Cloud API: POST /messages with status:"read".
     * Best-effort — failures are logged but never thrown.
     */
    async markAsRead(externalMessageId: string): Promise<void> {
      if (!externalMessageId) return;
      try {
        await post("/whatsapp/messages", {
          status: "read",
          messageId: externalMessageId,
        });
      } catch (e) {
        console.warn("[ycloud markAsRead] failed:", (e as Error).message);
      }
    },

    /**
     * Show "typing…" indicator. WhatsApp Cloud API added typing indicators
     * in 2024 — YCloud may or may not pass them through. Best-effort: we
     * try, log on failure, and never throw.
     */
    async showTyping(externalMessageId: string): Promise<void> {
      if (!externalMessageId) return;
      try {
        await post("/whatsapp/messages", {
          status: "read",
          messageId: externalMessageId,
          typingIndicator: { type: "text" },
        });
      } catch (e) {
        // Typing isn't broadly supported — silent fallback.
        console.warn("[ycloud showTyping] failed:", (e as Error).message);
      }
    },

    async sendText(input: SendTextInput): Promise<SendResult> {
      if (!input.toPhoneE164) {
        throw new Error("ycloud sendText requires toPhoneE164");
      }
      const json = await post("/whatsapp/messages", {
        from: config.fromPhoneE164,
        to: input.toPhoneE164,
        type: "text",
        text: { body: input.body },
      });
      const id = String(
        (json["id"] ?? json["wamid"] ?? json["messageId"]) as string,
      );
      return { providerMessageId: id, raw: json };
    },

    async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
      if (!input.toPhoneE164) {
        throw new Error("ycloud sendTemplate requires toPhoneE164");
      }
      const vars = input.variables ?? {};
      // Build WhatsApp template parameters in index order. Meta expects
      // body parameters as an ordered list.
      const params = Object.keys(vars)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => ({ type: "text", text: vars[k] }));
      const components = params.length
        ? [{ type: "body", parameters: params }]
        : [];
      const json = await post("/whatsapp/messages", {
        from: config.fromPhoneE164,
        to: input.toPhoneE164,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language },
          components,
        },
      });
      const id = String(
        (json["id"] ?? json["wamid"] ?? json["messageId"]) as string,
      );
      return { providerMessageId: id, raw: json };
    },
  };
}

/**
 * Normalize a YCloud webhook payload to our common format.
 * YCloud forwards Meta's WhatsApp Cloud API events almost verbatim.
 */
export function normalizeYCloudInbound(
  payload: Record<string, unknown>,
): NormalizedInboundMessage[] {
  const out: NormalizedInboundMessage[] = [];
  const now = Date.now();

  // Event shape 1: { event: "whatsapp.inbound_message.received", whatsappInboundMessage: {...} }
  const ev = payload["whatsappInboundMessage"] as
    | Record<string, unknown>
    | undefined;
  if (ev) {
    const from = String(ev["from"] ?? "");
    const id = String(ev["id"] ?? ev["wamid"] ?? "");
    const typeRaw = String(ev["type"] ?? "text");
    const fromName = (ev["profile"] as { name?: string } | undefined)?.name;
    const phoneNumberId = String(ev["phoneNumberId"] ?? "");
    const body =
      typeRaw === "text"
        ? String((ev["text"] as { body?: string } | undefined)?.body ?? "")
        : "";
    const media =
      typeRaw === "audio" || typeRaw === "image" || typeRaw === "video" || typeRaw === "document"
        ? (ev[typeRaw] as { link?: string; mime_type?: string } | undefined)
        : undefined;
    const contentType =
      typeRaw === "audio" || typeRaw === "voice" ? "voice_note" : (typeRaw as NormalizedInboundMessage["contentType"]);
    out.push({
      provider: "ycloud",
      channel: "whatsapp",
      externalMessageId: id || `yc-${now}-${Math.random()}`,
      fromPhoneE164: from.startsWith("+") ? from : `+${from}`,
      displayName: fromName,
      contentType,
      body,
      mediaUrl: media?.link,
      mediaMimeType: media?.mime_type,
      receivedAt: now,
      channelExternalId: phoneNumberId,
      raw: ev,
    });
    return out;
  }

  // Event shape 2: Meta-style { entry: [{ changes: [{ value: { messages: [...] } }] }] }
  const entries = payload["entry"] as Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string } }>;
        messages?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
  if (Array.isArray(entries)) {
    for (const e of entries) {
      for (const c of e.changes ?? []) {
        const val = c.value ?? {};
        const phoneNumberId = val.metadata?.phone_number_id ?? "";
        const name = val.contacts?.[0]?.profile?.name;
        for (const msg of val.messages ?? []) {
          const typeRaw = String(msg["type"] ?? "text");
          const from = String(msg["from"] ?? "");
          const id = String(msg["id"] ?? `yc-${now}-${Math.random()}`);
          const text = (msg["text"] as { body?: string } | undefined)?.body ?? "";
          const media =
            (msg[typeRaw] as { link?: string; mime_type?: string } | undefined) ??
            undefined;
          const contentType =
            typeRaw === "audio" || typeRaw === "voice"
              ? "voice_note"
              : (typeRaw as NormalizedInboundMessage["contentType"]);
          out.push({
            provider: "ycloud",
            channel: "whatsapp",
            externalMessageId: id,
            fromPhoneE164: from.startsWith("+") ? from : `+${from}`,
            displayName: name,
            contentType,
            body: text,
            mediaUrl: media?.link,
            mediaMimeType: media?.mime_type,
            receivedAt: now,
            channelExternalId: phoneNumberId,
            raw: msg,
          });
        }
      }
    }
  }

  return out;
}
