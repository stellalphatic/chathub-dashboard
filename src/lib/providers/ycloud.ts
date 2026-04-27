import type {
  ChannelSender,
  NormalizedInboundMessage,
  SendAudioInput,
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
     * YCloud's status update endpoint requires `from` (the business phone)
     * + `messageId` + `status:"read"`.
     * Best-effort — failures are logged but never thrown.
     */
    async markAsRead(externalMessageId: string): Promise<void> {
      if (!externalMessageId) return;
      if (!config.fromPhoneE164) return;
      try {
        await post("/whatsapp/messages", {
          from: config.fromPhoneE164,
          messageId: externalMessageId,
          status: "read",
        });
      } catch (e) {
        console.warn("[ycloud markAsRead] failed:", (e as Error).message);
      }
    },

    /**
     * Show "typing…" indicator (WhatsApp Cloud API 2024+). YCloud bundles
     * it with the same status update — same required fields.
     */
    async showTyping(externalMessageId: string): Promise<void> {
      if (!externalMessageId) return;
      if (!config.fromPhoneE164) return;
      try {
        await post("/whatsapp/messages", {
          from: config.fromPhoneE164,
          messageId: externalMessageId,
          status: "read",
          typingIndicator: { type: "text" },
        });
      } catch (e) {
        // Typing isn't broadly supported — silent fallback.
        console.warn("[ycloud showTyping] failed:", (e as Error).message);
      }
    },

    /**
     * Best-effort fetch of the contact's WhatsApp profile name when the
     * webhook didn't carry it. Returns undefined silently on any failure.
     */
    async fetchContactName(phoneE164: string): Promise<string | undefined> {
      try {
        const phone = phoneE164.startsWith("+") ? phoneE164 : `+${phoneE164}`;
        const url = `${BASE}/whatsapp/contacts/${encodeURIComponent(phone)}`;
        const res = await fetch(url, {
          headers: { "x-api-key": secrets.apiKey },
        });
        if (!res.ok) return undefined;
        const json = (await res.json()) as Record<string, unknown>;
        const candidates = [
          (json.profile as { name?: unknown } | undefined)?.name,
          json.name,
          (json.contact as { name?: unknown } | undefined)?.name,
        ];
        for (const c of candidates) {
          if (typeof c === "string" && c.trim()) return c.trim();
        }
        return undefined;
      } catch {
        return undefined;
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

    async sendAudio(input: SendAudioInput): Promise<SendResult> {
      if (!input.toPhoneE164) {
        throw new Error("ycloud sendAudio requires toPhoneE164");
      }
      if (!input.audioUrl) {
        throw new Error("ycloud sendAudio requires audioUrl");
      }
      const json = await post("/whatsapp/messages", {
        from: config.fromPhoneE164,
        to: input.toPhoneE164,
        type: "audio",
        audio: { link: input.audioUrl },
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
 * Try to find the WhatsApp profile name in any of the locations YCloud /
 * Meta have shipped over the years. Returns the first non-empty trimmed
 * string it finds, or undefined.
 */
function extractProfileName(
  payload: Record<string, unknown>,
  innerEvent?: Record<string, unknown>,
): string | undefined {
  type Maybe = unknown;
  function pickString(v: Maybe): string | undefined {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  const candidates: Maybe[] = [];
  // YCloud current shape — `customerProfile.name`. CONFIRMED via real
  // production webhook payload (Apr 2026):
  //   whatsappInboundMessage.customerProfile.name = "Usama"
  if (innerEvent) {
    const cp = innerEvent["customerProfile"] as { name?: unknown } | undefined;
    candidates.push(cp?.name);
    // Older variants
    const p1 = innerEvent["profile"] as { name?: unknown } | undefined;
    candidates.push(p1?.name);
    const p2 = innerEvent["whatsappContact"] as { name?: unknown } | undefined;
    candidates.push(p2?.name);
    const p3 = innerEvent["contact"] as
      | { name?: unknown; profile?: { name?: unknown } }
      | undefined;
    candidates.push(p3?.name);
    candidates.push(p3?.profile?.name);
    const p4 = innerEvent["senderProfile"] as { name?: unknown } | undefined;
    candidates.push(p4?.name);
    candidates.push(innerEvent["fromName"]);
    candidates.push(innerEvent["customerProfileName"]);
  }
  // Top-level (some webhooks include a contacts[] sibling at the root)
  const topContacts = payload["contacts"] as
    | Array<{ profile?: { name?: unknown }; name?: unknown }>
    | undefined;
  if (Array.isArray(topContacts) && topContacts.length > 0) {
    candidates.push(topContacts[0]?.profile?.name);
    candidates.push(topContacts[0]?.name);
  }
  for (const c of candidates) {
    const v = pickString(c);
    if (v) return v;
  }
  return undefined;
}

/**
 * Normalize a YCloud webhook payload to our common format.
 *
 * YCloud has shipped THREE webhook shapes over time. We handle all of them:
 *
 *   1) Modern (current):
 *        { type: "whatsapp.message.received" | "whatsapp.message.updated",
 *          whatsappMessage: {...} }
 *      `whatsappMessage` is used for BOTH inbound AND outbound status events.
 *      We only ingest when status is missing or `received` — status updates
 *      (sent / delivered / read / failed) are forwarded to providerMessageId
 *      tracking instead.
 *
 *   2) Older inbound:
 *        { type: "whatsapp.inbound_message.received",
 *          whatsappInboundMessage: {...} }
 *
 *   3) Raw Meta-passthrough:
 *        { entry: [{ changes: [{ value: { messages: [...] } }] }] }
 */
export function normalizeYCloudInbound(
  payload: Record<string, unknown>,
): NormalizedInboundMessage[] {
  const out: NormalizedInboundMessage[] = [];
  const now = Date.now();

  // Helper to extract a single message from a YCloud "inner event" object.
  // Returns the normalized message or null if it's something we shouldn't
  // ingest (e.g. an outbound status update).
  function fromInnerEvent(
    ev: Record<string, unknown>,
  ): NormalizedInboundMessage | null {
    // Status updates: { status: "sent" | "delivered" | "read" | "failed" }
    // YCloud reuses `whatsappMessage` for these; they're not new inbound.
    const status = ev["status"];
    if (
      typeof status === "string" &&
      ["sent", "delivered", "read", "failed"].includes(status)
    ) {
      return null;
    }
    const from = String(ev["from"] ?? "");
    const id = String(ev["id"] ?? ev["wamid"] ?? "");
    const typeRaw = String(ev["type"] ?? "text");
    const fromName = extractProfileName(payload, ev);
    const phoneNumberId = String(
      ev["phoneNumberId"] ?? ev["wabaPhoneNumberId"] ?? "",
    );
    const body =
      typeRaw === "text"
        ? String((ev["text"] as { body?: string } | undefined)?.body ?? "")
        : typeRaw === "interactive"
          ? extractInteractiveText(ev["interactive"])
          : "";
    const media =
      typeRaw === "audio" ||
      typeRaw === "image" ||
      typeRaw === "video" ||
      typeRaw === "document" ||
      typeRaw === "voice"
        ? (ev[typeRaw === "voice" ? "audio" : typeRaw] as
            | { link?: string; mime_type?: string; mimeType?: string }
            | undefined)
        : undefined;
    const contentType =
      typeRaw === "audio" || typeRaw === "voice"
        ? "voice_note"
        : (typeRaw as NormalizedInboundMessage["contentType"]);

    if (!from) return null;
    return {
      provider: "ycloud",
      channel: "whatsapp",
      externalMessageId: id || `yc-${now}-${Math.random()}`,
      fromPhoneE164: from.startsWith("+") ? from : `+${from}`,
      displayName: fromName,
      contentType,
      body,
      mediaUrl: media?.link,
      mediaMimeType: media?.mime_type ?? media?.mimeType,
      receivedAt: now,
      channelExternalId: phoneNumberId,
      raw: ev,
    };
  }

  // --- Shape 1 (current): { type:"whatsapp.message.received", whatsappMessage:{...} }
  const evNew = payload["whatsappMessage"] as
    | Record<string, unknown>
    | undefined;
  if (evNew) {
    const m = fromInnerEvent(evNew);
    if (m) out.push(m);
    return out;
  }

  // --- Shape 2 (older): whatsappInboundMessage
  const ev = payload["whatsappInboundMessage"] as
    | Record<string, unknown>
    | undefined;
  if (ev) {
    const m = fromInnerEvent(ev);
    if (m) out.push(m);
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
        // Prefer the contacts[0].profile.name (Meta-style); fall back to any
        // other places it might live.
        const rawName =
          val.contacts?.[0]?.profile?.name ??
          (val.contacts?.[0] as { name?: string } | undefined)?.name ??
          undefined;
        const name =
          typeof rawName === "string" && rawName.trim().length > 0
            ? rawName.trim()
            : undefined;
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

/** Pulls a usable text out of WhatsApp interactive replies (button / list). */
function extractInteractiveText(interactive: unknown): string {
  if (!interactive || typeof interactive !== "object") return "";
  const i = interactive as {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
    type?: string;
  };
  return (
    i.button_reply?.title ??
    i.list_reply?.title ??
    ""
  );
}
