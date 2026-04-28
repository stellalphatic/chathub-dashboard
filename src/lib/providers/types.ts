export type ChannelKind =
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "sms"
  | "voice";

export type ProviderKind =
  | "ycloud"
  | "manychat"
  | "meta"
  | "twilio"
  | "vonage"
  | "syrow";

export type NormalizedInboundMessage = {
  provider: ProviderKind;
  channel: ChannelKind;
  externalMessageId: string;
  // One of these identifies the sender:
  fromPhoneE164?: string;
  fromExternalId?: string; // IG/FB PSID
  displayName?: string;
  contentType: "text" | "image" | "audio" | "video" | "document" | "voice_note";
  body: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  receivedAt: number;
  /** `external_id` of the channel_connection this should be routed to. */
  channelExternalId?: string;
  raw: Record<string, unknown>;
};

export type SendTextInput = {
  toPhoneE164?: string;
  toExternalId?: string;
  body: string;
};

export type SendTemplateInput = {
  toPhoneE164?: string;
  toExternalId?: string;
  templateName: string;
  language: string;
  variables?: Record<string, string>;
};

export type SendResult = {
  providerMessageId: string;
  raw?: Record<string, unknown>;
};

export type SendAudioInput = {
  toPhoneE164?: string;
  toExternalId?: string;
  /** Public HTTPS URL the provider can fetch (we use S3). */
  audioUrl: string;
};

export type ChannelSender = {
  sendText(input: SendTextInput): Promise<SendResult>;
  sendTemplate?(input: SendTemplateInput): Promise<SendResult>;
  /**
   * Optional: send a voice / audio message. Provider expects an HTTPS URL
   * (we upload our TTS output to S3 first). If not implemented, callers
   * should fall back to `sendText` with the raw script.
   */
  sendAudio?(input: SendAudioInput): Promise<SendResult>;
  /**
   * Optional best-effort: tell the provider we've seen the inbound message
   * (drives WhatsApp's "blue ticks"). Implementations should swallow any
   * errors so a failed mark-as-read never breaks the reply flow.
   */
  markAsRead?(externalMessageId: string): Promise<void>;
  /**
   * Optional best-effort: show "typing…" to the customer for the next ~25s
   * so they see the AI is composing. Provider-specific; safely no-ops if
   * not supported.
   */
  showTyping?(externalMessageId: string): Promise<void>;
  /**
   * Optional best-effort: fetch the contact's profile display name from the
   * provider when the inbound webhook didn't carry it. Used for late-binding
   * customer.displayName so the LLM and CRM see real names.
   */
  fetchContactName?(phoneE164: string): Promise<string | undefined>;
};
