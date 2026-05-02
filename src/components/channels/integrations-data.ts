import type { ComponentType } from "react";
import { Facebook, Instagram, MessageCircle } from "lucide-react";

export type IntegrationField = {
  key: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
  help?: string;
  /** When true, the form will refuse to submit without a value. Defaults to true. */
  required?: boolean;
};

export type IntegrationStep = {
  title: string;
  body: string;
  links?: { label: string; href: string }[];
};

export type Integration = {
  id: string;
  category: "whatsapp" | "instagram" | "messenger";
  channel: "whatsapp" | "instagram" | "messenger";
  provider: "ycloud" | "meta" | "manychat" | "syrow";
  title: string;
  tagline: string;
  icon: ComponentType<{ className?: string }>;
  colorCls: string;
  recommended?: boolean;
  status?: "test" | "requires_approval";
  webhookPath: string; // e.g. /api/webhooks/ycloud
  webhookHelp?: string;
  steps: IntegrationStep[];
  configFields: IntegrationField[];
  secretFields: IntegrationField[];
  externalIdField?: {
    label: string;
    placeholder?: string;
    help?: string;
    /** Hide unless explicitly required for multi-tenant routing. Defaults to true. */
    required?: boolean;
  };
  /** When true, hide the "Internal label" field — most setups don't need it. */
  hideLabelField?: boolean;
  docsUrl?: string;
};

export const CATEGORY_LABELS: Record<Integration["category"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram DM",
  messenger: "Facebook Messenger",
};

export const INTEGRATIONS: Integration[] = [
  // ── WhatsApp ──────────────────────────────────────────────────────────────
  {
    id: "whatsapp-ycloud",
    category: "whatsapp",
    channel: "whatsapp",
    provider: "ycloud",
    title: "WhatsApp Business via YCloud",
    tagline:
      "Connect a real WhatsApp Business number via YCloud. Supports inbound + outbound, templates, and the 24-hour session window.",
    icon: MessageCircle,
    colorCls: "text-emerald-500",
    recommended: true,
    webhookPath: "/api/webhooks/ycloud",
    webhookHelp:
      "Paste this URL in YCloud → WhatsApp → Webhooks. ChatHub verifies the signature using the YCLOUD_WEBHOOK_SECRET server env.",
    docsUrl: "https://www.ycloud.com/docs",
    hideLabelField: true,
    steps: [
      {
        title: "Create a YCloud account & verify your number",
        body: "Sign up at ycloud.com, complete KYC, then add the WhatsApp Business number. Once verified, copy it in E.164 format (e.g. +14151234567).",
        links: [{ label: "YCloud signup", href: "https://www.ycloud.com" }],
      },
      {
        title: "Copy your YCloud API key",
        body: "YCloud dashboard → Settings → API keys → Create. This key lets ChatHub send messages on your behalf — keep it secret.",
      },
      {
        title: "Add the webhook URL above to YCloud",
        body: "YCloud → WhatsApp → Webhooks → Add a new endpoint. Paste the URL shown above. Tick Inbound Messages and Status Updates.",
      },
      {
        title: "Save credentials below",
        body: "Enter your sender phone (E.164) and your YCloud API key, then hit Save & connect. You'll show as Connected in a moment.",
      },
      {
        title: "Test it",
        body: "Send a WhatsApp message from a personal phone to the business number. It should appear in ChatHub → Inbox within 1–2 seconds, and the AI will reply if enabled.",
      },
    ],
    configFields: [
      {
        key: "fromPhoneE164",
        label: "WhatsApp business phone",
        placeholder: "+14151234567",
        help: "Your WhatsApp Business number in E.164 format (with country code).",
        required: true,
      },
    ],
    secretFields: [
      {
        key: "apiKey",
        label: "YCloud API key",
        type: "password",
        placeholder: "yc_live_xxx",
        required: true,
      },
    ],
    // No externalIdField — routing falls back to (provider, channel) which is
    // perfect for the typical 1-business-1-WhatsApp-number setup.
  },
  {
    id: "whatsapp-syrow",
    category: "whatsapp",
    channel: "whatsapp",
    provider: "syrow",
    title: "WhatsApp Business via Syrow Care",
    tagline:
      "Connect a WhatsApp Business number through Syrow's care platform. Inbound + outbound, templates, AI-Action forms.",
    icon: MessageCircle,
    colorCls: "text-emerald-500",
    webhookPath: "/api/webhooks/syrow",
    webhookHelp:
      "Paste this URL in Syrow → Stream → Webhooks. If you set SYROW_WEBHOOK_SECRET, ChatHub verifies the signature on every request (HMAC-SHA256 in X-Syrow-Signature, or a flat secret in X-Webhook-Secret).",
    docsUrl: "https://documenter.getpostman.com/view/23781764/2sAXqy3f5Z",
    hideLabelField: true,
    steps: [
      {
        title: "Sign in to Syrow Care and connect WhatsApp",
        body: "Go to care.syrow.com → connect your WhatsApp number (Meta WABA). Once verified, copy the number in E.164 format (e.g. +14151234567).",
        links: [{ label: "Syrow Care dashboard", href: "https://care.syrow.com" }],
      },
      {
        title: "Generate your API key",
        body: "Syrow dashboard → Settings → API → create a key. This is what ChatHub uses to send messages on your behalf — keep it secret.",
      },
      {
        title: "Copy your Stream Hash",
        body: "Each WhatsApp connection in Syrow has a Stream Hash (e.g. uNpd939V5qM). It identifies which WABA to send through. Find it in Syrow → Streams → your WhatsApp stream.",
      },
      {
        title: "Add the webhook URL above to your Stream",
        body: "Syrow → Streams → your stream → Webhooks → set the inbound URL to the URL shown above. Subscribe to message + status events.",
      },
      {
        title: "Save credentials below",
        body: "Enter your business phone (E.164), API key, and Stream Hash. Hit Save & connect — you'll show as Connected in a moment.",
      },
      {
        title: "Test it",
        body: "Send a WhatsApp message from a personal phone to the business number. It should appear in ChatHub → Inbox within 1–2 seconds, and the AI will reply if enabled.",
      },
    ],
    configFields: [
      {
        key: "fromPhoneE164",
        label: "WhatsApp business phone",
        placeholder: "+14151234567",
        help: "Your WhatsApp Business number in E.164 format (with country code).",
        required: true,
      },
      {
        key: "streamHash",
        label: "Stream hash",
        placeholder: "uNpd939V5qM",
        help: "From Syrow → Streams. Identifies which WhatsApp connection to send through.",
        required: true,
      },
    ],
    secretFields: [
      {
        key: "apiKey",
        label: "Syrow API key",
        type: "password",
        placeholder: "sk_syrow_xxx",
        required: true,
      },
    ],
  },
  {
    id: "whatsapp-manychat",
    category: "whatsapp",
    channel: "whatsapp",
    provider: "manychat",
    title: "WhatsApp via ManyChat",
    tagline:
      "If the business already runs WhatsApp flows in ManyChat, forward them to ChatHub so the AI agent and inbox light up without changing their existing automation.",
    icon: MessageCircle,
    colorCls: "text-emerald-500",
    webhookPath: "/api/webhooks/manychat",
    docsUrl: "https://help.manychat.com/hc/en-us/articles/5214024862364",
    steps: [
      {
        title: "Open the business's ManyChat workspace",
        body: "ManyChat → Settings → Installation → WhatsApp. Confirm the number is connected and live.",
      },
      {
        title: "Copy your ManyChat API key",
        body: "ManyChat → Settings → API → generate or copy the existing key.",
        links: [
          {
            label: "ManyChat API settings",
            href: "https://app.manychat.com/settings/api",
          },
        ],
      },
      {
        title: "Create a WhatsApp flow that forwards to ChatHub",
        body: "Flows → New Flow → Trigger: WhatsApp → Keyword/Any inbound. Add an External Request action with URL = the webhook below, method POST, JSON body {subscriber_id, channel: 'whatsapp', body}.",
      },
      {
        title: "Add the ChatHub signing header",
        body: "In the External Request → Headers, add key x-chathub-secret and value = the string you pasted in the MANYCHAT_WEBHOOK_SECRET env var. This lets ChatHub trust the request.",
      },
      {
        title: "Save your credentials",
        body: "Paste the ManyChat API key below, plus the ManyChat subscriber ID field your flow forwards. Hit Save & connect.",
      },
    ],
    configFields: [{ key: "note", label: "Internal label (optional)" }],
    secretFields: [
      {
        key: "apiKey",
        label: "ManyChat API key",
        type: "password",
        placeholder: "Settings → API",
      },
    ],
    externalIdField: {
      label: "ManyChat page / workspace ID",
      placeholder: "shown on the Settings page",
    },
  },

  // ── Instagram DM ──────────────────────────────────────────────────────────
  {
    id: "instagram-manychat",
    category: "instagram",
    channel: "instagram",
    provider: "manychat",
    title: "Instagram DM via ManyChat",
    tagline:
      "Receive and reply to Instagram DMs through ManyChat. The business keeps any flows they already built — ChatHub layers the AI agent on top.",
    icon: Instagram,
    colorCls: "text-pink-500",
    recommended: true,
    webhookPath: "/api/webhooks/manychat",
    docsUrl: "https://help.manychat.com/hc/en-us/articles/360038289234",
    steps: [
      {
        title: "Prerequisite: Instagram Business / Creator account",
        body: "Personal accounts can't use the DM API. In Instagram → Settings → Account type → switch to Professional.",
      },
      {
        title: "Connect Instagram to ManyChat",
        body: "ManyChat → Settings → Connected Channels → Instagram → Connect. Log in with Facebook and grant ManyChat permission to manage the Instagram account. Instagram must be linked to a Facebook Page.",
      },
      {
        title: "Copy your ManyChat API key",
        body: "ManyChat → Settings → API → copy the key. This key lets ChatHub send outbound Instagram DMs on your behalf.",
        links: [
          {
            label: "ManyChat API settings",
            href: "https://app.manychat.com/settings/api",
          },
        ],
      },
      {
        title: "Create an Instagram DM flow",
        body: "Flows → New Flow → Trigger: Instagram → User sends a message. Fires on every DM.",
      },
      {
        title: "Add the ChatHub webhook action",
        body: "After the trigger → Action → Send External Request. Method POST, URL = the webhook below. Body JSON: {subscriber_id, channel: 'instagram', body: '{{last_input_text}}'}.",
      },
      {
        title: "(Optional) Webhook signing secret",
        body: "Headers → add x-chathub-secret = the string you set in MANYCHAT_WEBHOOK_SECRET. Paste the same value in the Credentials tab.",
      },
      {
        title: "Paste API key and save",
        body: "Enter your ManyChat API key below and click Save & connect. ChatHub will show Connected.",
      },
      {
        title: "Test it",
        body: "DM your Instagram account from a personal profile. You should see the thread in ChatHub Inbox within a second.",
      },
    ],
    configFields: [{ key: "note", label: "Internal label (optional)" }],
    secretFields: [
      {
        key: "apiKey",
        label: "ManyChat API key",
        type: "password",
        placeholder: "Settings → API",
      },
    ],
    externalIdField: {
      label: "ManyChat page ID",
      placeholder: "from Settings → Installation",
    },
  },
  {
    id: "instagram-meta",
    category: "instagram",
    channel: "instagram",
    provider: "meta",
    title: "Instagram DM via Meta Graph (direct)",
    tagline:
      "Direct Instagram Messenger Platform integration. More control, more work — use this when the business already has a Meta app.",
    icon: Instagram,
    colorCls: "text-pink-500",
    status: "requires_approval",
    webhookPath: "/api/webhooks/meta",
    webhookHelp:
      "After Save & connect, copy the Callback URL + Verify Token from this card into Meta → Instagram → API setup with Instagram Login → Configure webhooks. Each business has its own URL (includes connection id). POSTs are verified with the App Secret you save below.",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/instagram",
    hideLabelField: true,
    steps: [
      {
        title: "Create a Meta App",
        body: "developers.facebook.com → My Apps → Create App → Business. Add the Instagram product and open **Instagram → API setup with Instagram Login**.",
      },
      {
        title: "Link the Instagram Professional account",
        body: "Instagram API setup → Add account → log in with the Instagram Business / Creator account (must be linked to a Facebook Page).",
      },
      {
        title: "Generate a long-lived Page access token",
        body: "In API setup, generate a token for the Page connected to Instagram. Long-lived tokens usually start with **EAAG…**. Paste it below — ChatHub uses it only to send/receive on your behalf.",
      },
      {
        title: "Copy your App Secret (webhook signatures)",
        body: "Meta App → **Settings → Basic → App Secret** (same value shown under Instagram API setup as “Instagram app secret” in some dashboards). Used to verify **X-Hub-Signature-256** on every inbound webhook — treat it like a password. Each business pastes **its own** secret; we encrypt it at rest.",
      },
      {
        title: "Save credentials + connect",
        body: "Click **Save & connect** below. This page then shows your **Callback URL** and **Verify Token** — same pair for Development and Live (Meta uses one webhook config for the Instagram API).",
      },
      {
        title: "Configure webhooks in Meta",
        body: "Instagram → API setup → **Configure webhooks**: Callback URL and Verify Token = the values shown on this card after save. Subscribe to **messages** (and optionally reactions). Click **Verify and save** in Meta.",
      },
      {
        title: "Subscribe to fields",
        body: "Once Meta says verified, subscribe to: messages, message_reactions, messaging_postbacks.",
      },
      {
        title: "Submit for App Review (production only)",
        body: "Meta requires App Review for instagram_manage_messages. In Development mode only Testers (Roles tab) can DM. Plan 1–4 weeks for review.",
      },
    ],
    configFields: [
      {
        key: "igUserId",
        label: "Instagram Business Account ID (optional)",
        placeholder: "Leave blank to auto-detect from token",
        help: "Numeric **Instagram-scoped user ID** for the professional account (Meta → Instagram → API setup, account table). If you use a Page access token from the linked Page, you can leave this blank — we fetch it from Graph on save.",
        required: false,
      },
    ],
    secretFields: [
      {
        key: "accessToken",
        label: "Instagram / Page access token (long-lived)",
        type: "password",
        placeholder: "EAAG…",
        help: "Long-lived **Page** token with `instagram_manage_messages` (and related) permissions. This is what NordX labels “Instagram user access token” in some flows — in Meta it is generated from the Page linked to Instagram.",
        required: true,
      },
      {
        key: "appSecret",
        label: "Instagram / Meta App Secret",
        type: "password",
        placeholder: "Click Show in Meta → Settings → Basic",
        help: "Used to verify **X-Hub-Signature-256** on webhooks. Same secret as **App Secret** under App settings (Instagram API setup may label it “Instagram app secret”).",
        required: true,
      },
    ],
    // No externalIdField — `igUserId` is auto-used as the routing key.
  },

  // ── Facebook Messenger ────────────────────────────────────────────────────
  {
    id: "messenger-manychat",
    category: "messenger",
    channel: "messenger",
    provider: "manychat",
    title: "Messenger via ManyChat",
    tagline:
      "Forward Facebook Messenger events from ManyChat to ChatHub. Best if the business is already ManyChat-native.",
    icon: Facebook,
    colorCls: "text-blue-500",
    webhookPath: "/api/webhooks/manychat",
    docsUrl: "https://help.manychat.com/",
    steps: [
      {
        title: "Connect the Facebook Page",
        body: "ManyChat → Settings → Connected Channels → Facebook Messenger → log in and authorize the Page.",
      },
      {
        title: "Create a Messenger flow",
        body: "Flows → New Flow → Trigger: Messenger → Default Reply / Keyword / Any Message.",
      },
      {
        title: "Add the ChatHub External Request action",
        body: "Method POST, URL = the webhook above. JSON body {subscriber_id, channel: 'messenger', body}.",
      },
      {
        title: "Add the signing header",
        body: "Headers → x-chathub-secret = same as MANYCHAT_WEBHOOK_SECRET env.",
      },
      {
        title: "Paste API key below",
        body: "ManyChat → Settings → API → copy. Paste and save.",
      },
    ],
    configFields: [{ key: "note", label: "Internal label (optional)" }],
    secretFields: [
      {
        key: "apiKey",
        label: "ManyChat API key",
        type: "password",
      },
    ],
    externalIdField: {
      label: "ManyChat page / Facebook Page ID",
      placeholder: "find in Settings",
    },
  },
  {
    id: "messenger-meta",
    category: "messenger",
    channel: "messenger",
    provider: "meta",
    title: "Messenger via Meta Graph (direct)",
    tagline:
      "Direct connection to the Facebook Page's Messenger. Same Meta app setup you'd use for Instagram DM.",
    icon: Facebook,
    colorCls: "text-blue-500",
    status: "requires_approval",
    webhookPath: "/api/webhooks/meta",
    webhookHelp:
      "After Save & connect, use the Callback URL + Verify Token from this card in Messenger → Webhooks (per-business URL includes your connection id).",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform",
    hideLabelField: true,
    steps: [
      {
        title: "Create a Meta App and add Messenger",
        body: "developers.facebook.com → My Apps → Create App → Business. Add the Messenger product.",
      },
      {
        title: "Subscribe the Facebook Page",
        body: "Messenger → Settings → Add or Remove Pages → select the Page you want to connect.",
      },
      {
        title: "Generate a long-lived Page access token",
        body: "Messenger → Access Tokens → pick the Page → copy the token. Paste it below.",
      },
      {
        title: "Copy your Meta App Secret",
        body: "Meta App → Settings → Basic → App Secret → click Show → copy. Paste it below. Each business uses ITS OWN app secret — encrypted with AES-256-GCM in our database.",
      },
      {
        title: "Save credentials below + click Save & connect",
        body: "After saving, this card will show a per-business webhook URL + verify token unique to your connection. Paste those into Meta in the next step.",
      },
      {
        title: "Register webhook in Meta",
        body: "Messenger → Webhooks → Add callback URL = the per-business URL shown after you save. Verify token = the per-business token shown after you save. Click Verify and save.",
      },
      {
        title: "Subscribe to fields",
        body: "Subscribe to: messages, messaging_postbacks, message_deliveries.",
      },
      {
        title: "App Review for messages permission",
        body: "Meta requires App Review to message users outside the 24-hour customer-service window. Plan 1–4 weeks.",
      },
    ],
    configFields: [
      {
        key: "pageId",
        label: "Facebook Page ID",
        placeholder: "1234567890",
        help: "The Page's numeric ID (Page → About → Page Transparency).",
        required: true,
      },
    ],
    secretFields: [
      {
        key: "accessToken",
        label: "Page access token",
        type: "password",
        placeholder: "EAAG…",
        help: "Long-lived Page token from Messenger → Access Tokens.",
        required: true,
      },
      {
        key: "appSecret",
        label: "Meta App Secret",
        type: "password",
        placeholder: "32-char hex string",
        help: "Meta App → Settings → Basic → App Secret. Used to verify inbound webhook signatures from THIS business's Meta app.",
        required: true,
      },
    ],
    // No externalIdField — `pageId` is auto-used as the routing key.
  },
];
