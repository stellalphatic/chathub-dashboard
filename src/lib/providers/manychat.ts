import type {
  ChannelSender,
  NormalizedInboundMessage,
  SendResult,
  SendTextInput,
} from "./types";

/**
 * ManyChat adapter — used for Instagram + Facebook Messenger when the business
 * already runs flows there.
 *
 * Secrets: { apiKey: string }
 * Config:  { channel: "instagram" | "messenger" }
 *
 * Webhook: ManyChat sends configurable JSON via its "External Request" or
 * "Trigger" actions. We rely on a shared `x-chathub-secret` header the flow
 * owner sets when wiring the trigger — see docs/MANYCHAT_SETUP.md.
 */

const BASE = "https://api.manychat.com";

export type ManyChatSecrets = {
  apiKey: string;
};

export type ManyChatConfig = {
  channel: "instagram" | "messenger";
};

export function createManyChatSender(
  secrets: ManyChatSecrets,
  config: ManyChatConfig,
): ChannelSender {
  return {
    async sendText(input: SendTextInput): Promise<SendResult> {
      if (!input.toExternalId) {
        throw new Error("ManyChat sendText requires toExternalId (subscriber id)");
      }
      const url = `${BASE}/fb/sending/sendContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secrets.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subscriber_id: input.toExternalId,
          data: {
            version: "v2",
            content: {
              messages: [{ type: "text", text: input.body }],
            },
          },
          message_tag: "ACCOUNT_UPDATE",
        }),
      });
      if (!res.ok) {
        throw new Error(`manychat ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as Record<string, unknown>;
      void config; // reserved for per-channel future fanout
      return {
        providerMessageId: String(json["message_id"] ?? `mc-${Date.now()}`),
        raw: json,
      };
    },
  };
}

/**
 * Expected ManyChat external-request payload (user-defined):
 * {
 *   "subscriber_id": "123",
 *   "channel": "instagram",
 *   "first_name": "...",
 *   "last_name": "...",
 *   "last_input_text": "hello",
 *   "page_id": "...",
 *   "platform_id": "..."
 * }
 */
export function normalizeManyChatInbound(
  payload: Record<string, unknown>,
): NormalizedInboundMessage[] {
  const now = Date.now();
  const channelRaw = String(payload["channel"] ?? "messenger");
  const channel: NormalizedInboundMessage["channel"] =
    channelRaw === "instagram" ? "instagram" : "messenger";
  const subscriberId = String(payload["subscriber_id"] ?? "");
  if (!subscriberId) return [];

  const firstName = String(payload["first_name"] ?? "");
  const lastName = String(payload["last_name"] ?? "");
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  const text = String(payload["last_input_text"] ?? payload["text"] ?? "");
  const id = String(payload["message_id"] ?? `mc-${now}-${subscriberId}`);

  return [
    {
      provider: "manychat",
      channel,
      externalMessageId: id,
      fromExternalId: subscriberId,
      displayName: name || undefined,
      contentType: "text",
      body: text,
      receivedAt: now,
      channelExternalId: String(payload["page_id"] ?? payload["platform_id"] ?? ""),
      raw: payload,
    },
  ];
}
