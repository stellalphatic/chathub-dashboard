export type ChannelKind =
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "sms"
  | "voice";

export type ProviderKind = "ycloud" | "manychat" | "meta" | "twilio" | "vonage";

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

export type ChannelSender = {
  sendText(input: SendTextInput): Promise<SendResult>;
  sendTemplate?(input: SendTemplateInput): Promise<SendResult>;
};
