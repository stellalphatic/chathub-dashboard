import type {
  ChannelSender,
  NormalizedInboundMessage,
  SendAudioInput,
  SendResult,
  SendTemplateInput,
  SendTextInput,
} from "./types";

/**
 * Syrow Care WhatsApp Business API adapter.
 *
 * Docs: https://documenter.getpostman.com/view/23781764/2sAXqy3f5Z
 *
 * What we know from the public Postman collection:
 *   - Base URL:  https://api.care.syrow.com
 *   - Send:      POST /api/V1/{streamHash}/send/message
 *                Body uses Meta WhatsApp Cloud API shape
 *                (recipient_type, messaging_product, to, type, text|template|...)
 *   - Auth:      Authorization: Bearer <API_KEY>  (Syrow's "API_KEY" variable)
 *
 *   - Inbound webhook: Syrow proxies Meta-style payloads to whatever URL
 *     the operator configures in their Syrow dashboard. Our /api/webhooks/syrow
 *     route accepts the Meta `entry → changes → value → messages[]` shape
 *     plus a flatter shape we've seen in the wild.
 *
 *   - "AI Action Data Submission" webhook: a separate JSON event Syrow
 *     fires when a customer fills a Syrow AI form. We log it as a
 *     conversation note attached to the customer (best-effort).
 *
 * Stored secrets (per channel_connection.secretsCiphertext):
 *   { apiKey: string }
 *
 * Stored config (channel_connection.config):
 *   { streamHash: string, fromPhoneE164: string }
 */

export type SyrowSecrets = {
  apiKey: string;
};

export type SyrowConfig = {
  streamHash: string;
  fromPhoneE164: string;
};

const BASE = "https://api.care.syrow.com";

export function createSyrowSender(
  secrets: SyrowSecrets,
  config: SyrowConfig,
): ChannelSender {
  if (!config.streamHash) {
    // We surface a clear runtime error instead of silently failing the send.
    // The bot config form rejects empty streamHash so this is a safety net.
    console.warn("[syrow] missing streamHash in config — sends will fail");
  }

  async function post(path: string, body: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secrets.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`syrow ${path} ${res.status}: ${text.slice(0, 400)}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  function sendPath() {
    return `/api/V1/${encodeURIComponent(config.streamHash)}/send/message`;
  }

  function pickProviderId(json: Record<string, unknown>): string {
    // Syrow returns { status, message, data: { wamid? | id? | message_id? } }
    const data = (json["data"] ?? json) as Record<string, unknown>;
    return String(
      data["wamid"] ??
        data["message_id"] ??
        data["id"] ??
        json["wamid"] ??
        `syrow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
  }

  return {
    async sendText(input: SendTextInput): Promise<SendResult> {
      if (!input.toPhoneE164) {
        throw new Error("syrow sendText requires toPhoneE164");
      }
      const json = await post(sendPath(), {
        recipient_type: "individual",
        messaging_product: "whatsapp",
        to: stripPlus(input.toPhoneE164),
        type: "text",
        text: { body: input.body },
      });
      return { providerMessageId: pickProviderId(json), raw: json };
    },

    async sendTemplate(input: SendTemplateInput): Promise<SendResult> {
      if (!input.toPhoneE164) {
        throw new Error("syrow sendTemplate requires toPhoneE164");
      }
      const vars = input.variables ?? {};
      const params = Object.keys(vars)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => ({ type: "text", text: vars[k] }));
      const components = params.length
        ? [{ type: "body", parameters: params }]
        : [];
      const json = await post(sendPath(), {
        recipient_type: "individual",
        messaging_product: "whatsapp",
        to: stripPlus(input.toPhoneE164),
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language },
          components,
        },
      });
      return { providerMessageId: pickProviderId(json), raw: json };
    },

    async sendAudio(input: SendAudioInput): Promise<SendResult> {
      if (!input.toPhoneE164) {
        throw new Error("syrow sendAudio requires toPhoneE164");
      }
      if (!input.audioUrl) {
        throw new Error("syrow sendAudio requires audioUrl");
      }
      const json = await post(sendPath(), {
        recipient_type: "individual",
        messaging_product: "whatsapp",
        to: stripPlus(input.toPhoneE164),
        type: "audio",
        audio: { link: input.audioUrl },
      });
      return { providerMessageId: pickProviderId(json), raw: json };
    },

    /**
     * Syrow's Meta-style endpoint for marking inbound as read isn't
     * explicitly documented in their public Postman. We POST the Cloud-
     * API-style body to the same /send/message route — Syrow forwards
     * status updates to Meta for the same WABA. Failures are silent.
     */
    async markAsRead(externalMessageId: string): Promise<void> {
      if (!externalMessageId || !config.streamHash) return;
      try {
        await post(sendPath(), {
          messaging_product: "whatsapp",
          status: "read",
          message_id: externalMessageId,
        });
      } catch (e) {
        const msg = (e as Error).message;
        if (/404|NOT_FOUND|400/.test(msg)) return;
        console.warn("[syrow markAsRead] failed:", msg);
      }
    },

    async showTyping(externalMessageId: string): Promise<void> {
      if (!externalMessageId || !config.streamHash) return;
      try {
        await post(sendPath(), {
          messaging_product: "whatsapp",
          status: "read",
          message_id: externalMessageId,
          typing_indicator: { type: "text" },
        });
      } catch (e) {
        const msg = (e as Error).message;
        if (/404|NOT_FOUND|400/.test(msg)) return;
        console.warn("[syrow showTyping] failed:", msg);
      }
    },
  };
}

function stripPlus(p: string): string {
  return p.startsWith("+") ? p.slice(1) : p;
}

/**
 * Normalize a Syrow webhook payload into our common inbound shape.
 *
 * Handles:
 *   - Meta-style:  { entry: [{ changes: [{ value: { metadata, contacts, messages } }] }] }
 *   - Flat-style:  { messaging_product, to, from, type, text, profile, ... }
 *   - Syrow-tagged: { stream_hash, source: "whatsapp", message: {...} }
 *
 * Skips status updates (sent / delivered / read / failed) — those don't
 * generate inbound messages.
 */
export function normalizeSyrowInbound(
  payload: Record<string, unknown>,
): NormalizedInboundMessage[] {
  const out: NormalizedInboundMessage[] = [];
  const now = Date.now();

  function pushFromMessage(
    msg: Record<string, unknown>,
    contacts:
      | Array<{ profile?: { name?: string }; wa_id?: string }>
      | undefined,
    phoneNumberId: string,
    streamHash: string | undefined,
  ): void {
    if (!msg) return;
    const status = msg["status"];
    if (
      typeof status === "string" &&
      ["sent", "delivered", "read", "failed"].includes(status)
    ) {
      return;
    }
    const typeRaw = String(msg["type"] ?? "text");
    const from = String(msg["from"] ?? "");
    const id = String(msg["id"] ?? msg["wamid"] ?? `syrow-${now}-${Math.random()}`);
    const body =
      typeRaw === "text"
        ? String((msg["text"] as { body?: string } | undefined)?.body ?? "")
        : typeRaw === "interactive"
          ? extractInteractiveText(msg["interactive"])
          : "";
    const media =
      typeRaw === "audio" ||
      typeRaw === "image" ||
      typeRaw === "video" ||
      typeRaw === "document" ||
      typeRaw === "voice"
        ? (msg[typeRaw === "voice" ? "audio" : typeRaw] as
            | { link?: string; mime_type?: string }
            | undefined)
        : undefined;
    const contentType =
      typeRaw === "audio" || typeRaw === "voice"
        ? "voice_note"
        : (typeRaw as NormalizedInboundMessage["contentType"]);
    const profileName =
      contacts?.[0]?.profile?.name ??
      (msg["profile"] as { name?: string } | undefined)?.name ??
      (msg["customerProfile"] as { name?: string } | undefined)?.name;
    if (!from) return;
    out.push({
      provider: "syrow",
      channel: "whatsapp",
      externalMessageId: id,
      fromPhoneE164: from.startsWith("+") ? from : `+${from}`,
      displayName: profileName?.trim() || undefined,
      contentType,
      body,
      mediaUrl: media?.link,
      mediaMimeType: media?.mime_type,
      receivedAt: now,
      // Prefer the Syrow stream_hash for routing — that's the identifier
      // the operator pasted into the bot config. Falls back to the Meta
      // phoneNumberId if Syrow forwards it through.
      channelExternalId: streamHash || phoneNumberId,
      raw: msg,
    });
  }

  // Shape A — Meta-style envelope
  const entries = payload["entry"] as Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<Record<string, unknown>>;
      };
    }>;
  }>;
  const streamHashTop =
    typeof payload["stream_hash"] === "string"
      ? (payload["stream_hash"] as string)
      : undefined;

  if (Array.isArray(entries)) {
    for (const e of entries) {
      for (const c of e.changes ?? []) {
        const val = c.value ?? {};
        const phoneNumberId = val.metadata?.phone_number_id ?? "";
        for (const msg of val.messages ?? []) {
          pushFromMessage(msg, val.contacts, phoneNumberId, streamHashTop);
        }
      }
    }
    if (out.length > 0) return out;
  }

  // Shape B — Syrow-tagged single message wrapper
  const wrapped = payload["message"] as Record<string, unknown> | undefined;
  if (wrapped && typeof wrapped === "object") {
    pushFromMessage(wrapped, undefined, "", streamHashTop);
    if (out.length > 0) return out;
  }

  // Shape C — flat (the message object IS the payload)
  if (payload["messaging_product"] === "whatsapp" && payload["from"]) {
    pushFromMessage(
      payload,
      undefined,
      String(payload["phone_number_id"] ?? ""),
      streamHashTop,
    );
  }

  return out;
}

function extractInteractiveText(interactive: unknown): string {
  if (!interactive || typeof interactive !== "object") return "";
  const i = interactive as {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
    nfm_reply?: { response_json?: string };
  };
  return i.button_reply?.title ?? i.list_reply?.title ?? "";
}
