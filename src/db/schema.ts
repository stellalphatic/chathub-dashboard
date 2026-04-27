import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Better Auth tables
// ─────────────────────────────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  platformAdmin: boolean("platform_admin").notNull().default(false),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant & membership
// ─────────────────────────────────────────────────────────────────────────────

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    ingestSecret: text("ingest_secret").notNull(),
    // plan / status
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"), // active|suspended|trial
    // feature flags & quotas (stored JSON so admins can adjust without migrations)
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    // messages / tokens usage cache
    monthlyMessageCap: integer("monthly_message_cap").notNull().default(10000),
    monthlyTokenCap: integer("monthly_token_cap").notNull().default(2_000_000),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    slugUid: uniqueIndex("organization_slug_uidx").on(t.slug),
  }),
);

export const organizationMember = pgTable(
  "organization_member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // owner|admin|agent|viewer
    role: text("role").notNull().default("agent"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgUserUid: uniqueIndex("organization_member_org_user_uidx").on(
      t.organizationId,
      t.userId,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Channels & integrations (encrypted credentials live here)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per connected channel for a business.
 * `provider` is how messages are moved; `channel` is how the end customer sees it.
 *
 * channel:   whatsapp | instagram | messenger | sms | voice
 * provider:  ycloud | manychat | meta | twilio | vonage
 * config:    plaintext non-secret fields (phone number id, page id, etc.)
 * secrets:   AES-GCM ciphertext blob (see lib/encryption.ts)
 */
export const channelConnection = pgTable(
  "channel_connection",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    provider: text("provider").notNull(),
    label: text("label"),
    externalId: text("external_id"), // phone number id, page id, ig user id…
    status: text("status").notNull().default("connected"), // connected|error|disconnected
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    // AES-GCM encrypted JSON blob holding api keys / access tokens
    secretsCiphertext: text("secrets_ciphertext"),
    webhookSecret: text("webhook_secret"), // for signature verification
    lastErrorAt: timestamp("last_error_at", { mode: "date" }),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgChannelProviderIdx: index("channel_conn_org_channel_idx").on(
      t.organizationId,
      t.channel,
    ),
    externalIdx: index("channel_conn_external_idx").on(
      t.provider,
      t.externalId,
    ),
  }),
);

// Legacy table kept for backward compatibility; new work should use channel_connection.
export const integration = pgTable("integration", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  label: text("label"),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Customers, conversations, messages
// ─────────────────────────────────────────────────────────────────────────────

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    displayName: text("display_name"),
    email: text("email"),
    // arbitrary profile fields (channel-specific ids live here: ig_user_id, fb_psid, …)
    profile: jsonb("profile").$type<Record<string, unknown>>().default({}),
    tags: jsonb("tags").$type<string[]>().default([]),
    status: text("status").notNull().default("new"), // new|active|follow_up|converted|dnd
    lastContactedAt: timestamp("last_contacted_at", { mode: "date" }),
    meetingBooked: boolean("meeting_booked").notNull().default(false),
    meetingTime: text("meeting_time"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgPhoneUid: uniqueIndex("customer_org_phone_uidx").on(
      t.organizationId,
      t.phoneE164,
    ),
    orgIdx: index("customer_org_idx").on(t.organizationId),
  }),
);

/**
 * A conversation = a customer on a specific channel.
 * Phone-ish across WhatsApp/SMS/Voice share one customer but different conversations.
 */
export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // whatsapp|instagram|messenger|sms|voice
    channelConnectionId: text("channel_connection_id").references(
      () => channelConnection.id,
      { onDelete: "set null" },
    ),
    // Who is driving this conversation right now
    assigneeUserId: text("assignee_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // bot|human|hybrid — bot auto-replies off when set to "human"
    mode: text("mode").notNull().default("bot"),
    status: text("status").notNull().default("open"), // open|snoozed|closed
    unreadCount: integer("unread_count").notNull().default(0),
    // Last inbound from customer (start of 24h WhatsApp session window)
    lastInboundAt: timestamp("last_inbound_at", { mode: "date" }),
    lastMessageAt: timestamp("last_message_at", { mode: "date" }),
    lastMessagePreview: text("last_message_preview"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgCustChanUid: uniqueIndex("conversation_org_cust_chan_uidx").on(
      t.organizationId,
      t.customerId,
      t.channel,
    ),
    orgRecentIdx: index("conversation_org_recent_idx").on(
      t.organizationId,
      t.lastMessageAt,
    ),
  }),
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversation.id, {
      onDelete: "cascade",
    }),
    channel: text("channel"), // whatsapp|instagram|messenger|sms|voice
    direction: text("direction").notNull(), // inbound|outbound
    // text|image|audio|video|document|template|interactive|voice_note
    contentType: text("content_type").notNull().default("text"),
    body: text("body").notNull().default(""),
    mediaUrl: text("media_url"),
    mediaMimeType: text("media_mime_type"),
    transcript: text("transcript"), // for voice notes / calls
    // outbound-only: who/what sent it
    sentByUserId: text("sent_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    sentByBot: boolean("sent_by_bot").notNull().default(false),
    // template send tracking
    templateId: text("template_id"),
    // delivery state
    status: text("status").notNull().default("received"), // queued|sending|sent|delivered|read|failed|received
    failureReason: text("failure_reason"),
    providerMessageId: text("provider_message_id"),
    sentiment: text("sentiment"), // positive|negative|neutral
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    // For the inbound reconciliation pass — set once an LLM reply has been
    // (re-)scheduled. Null means "still might need a reply".
    inboundReconciledAt: timestamp("inbound_reconciled_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgCustomerCreatedIdx: index("message_org_customer_created_idx").on(
      t.organizationId,
      t.customerId,
      t.createdAt,
    ),
    orgConvCreatedIdx: index("message_org_conv_created_idx").on(
      t.organizationId,
      t.conversationId,
      t.createdAt,
    ),
    orgProviderUid: uniqueIndex("message_org_provider_uidx").on(
      t.organizationId,
      t.providerMessageId,
    ),
  }),
);

/** Human handoff events (audit trail + latency measurement) */
export const handoff = pgTable("handoff", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  reason: text("reason"), // low_confidence|explicit_request|escalation|sentiment
  fromMode: text("from_mode"),
  toMode: text("to_mode"),
  assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// AI agent (bot) configuration + RAG knowledge base
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One bot config per organization (v1). Tone, persona, rules, escalation.
 */
export const botConfig = pgTable("bot_config", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" })
    .unique(),
  enabled: boolean("enabled").notNull().default(true),
  name: text("name").notNull().default("Assistant"),
  persona: text("persona"),
  systemPrompt: text("system_prompt"),
  // comma-separated escalation triggers (e.g. "refund,human,agent,cancel")
  escalationKeywords: text("escalation_keywords").default(""),
  escalateOnLowConfidence: boolean("escalate_on_low_confidence")
    .notNull()
    .default(true),
  confidenceThreshold: integer("confidence_threshold").notNull().default(55),
  // primary model chain (JSON list overrides platform default)
  modelChain: jsonb("model_chain").$type<string[]>().default([]),
  // RAG settings
  ragEnabled: boolean("rag_enabled").notNull().default(false),
  vectorStore: text("vector_store").notNull().default("qdrant"), // qdrant|pinecone
  vectorNamespace: text("vector_namespace"),
  // 0-1 temperature stored as int/100 so we don't need numeric column
  temperatureX100: integer("temperature_x100").notNull().default(30),
  maxOutputTokens: integer("max_output_tokens").notNull().default(400),
  // safety / content controls
  allowOutboundWithout24h: boolean("allow_outbound_without_24h")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** FAQ / short answers hot-path (checked before LLM) */
export const botFaq = pgTable("bot_faq", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** Uploaded file (PDF/DOCX/TXT/HTML). Storage is S3/R2 + URL. */
export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    source: text("source").notNull().default("upload"), // upload|url|text
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    // URL to original file (S3 or equivalent)
    fileUrl: text("file_url"),
    // embedding pipeline
    status: text("status").notNull().default("pending"), // pending|processing|indexed|failed
    failureReason: text("failure_reason"),
    chunkCount: integer("chunk_count").notNull().default(0),
    vectorStore: text("vector_store").notNull().default("qdrant"),
    vectorNamespace: text("vector_namespace"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("document_org_idx").on(t.organizationId),
  }),
);

/**
 * Vector DB holds the actual embeddings. We keep the text chunks in Postgres
 * for citation + re-embedding, keyed by the same chunkId used as the vector id.
 */
export const documentChunk = pgTable(
  "document_chunk",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    ord: integer("ord").notNull(),
    content: text("content").notNull(),
    tokens: integer("tokens"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    docOrdIdx: index("document_chunk_doc_ord_idx").on(t.documentId, t.ord),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Templates, scheduling, broadcasts
// ─────────────────────────────────────────────────────────────────────────────

/** WhatsApp / IG template catalog */
export const template = pgTable(
  "template",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("whatsapp"),
    name: text("name").notNull(), // Meta template name (must match)
    language: text("language").notNull().default("en"),
    category: text("category").notNull().default("MARKETING"),
    status: text("status").notNull().default("draft"), // draft|pending|approved|rejected
    bodyPreview: text("body_preview").notNull(),
    // placeholder variables used in body {{1}} {{2}} etc.
    variables: jsonb("variables").$type<string[]>().default([]),
    // provider-specific info (ycloud template id, meta id…)
    providerRef: jsonb("provider_ref").$type<Record<string, unknown>>().default(
      {},
    ),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgNameLangUid: uniqueIndex("template_org_name_lang_uidx").on(
      t.organizationId,
      t.name,
      t.language,
    ),
  }),
);

/**
 * Scheduled sends. Two common uses:
 *   1. Follow-up to a specific customer after the 24h session window closes
 *      (must use an approved template).
 *   2. Part of a broadcast (belongs to `broadcastId`).
 */
export const scheduledMessage = pgTable(
  "scheduled_message",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    broadcastId: text("broadcast_id"),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("whatsapp"),
    channelConnectionId: text("channel_connection_id").references(
      () => channelConnection.id,
      { onDelete: "set null" },
    ),
    templateId: text("template_id").references(() => template.id, {
      onDelete: "set null",
    }),
    // rendered variables
    variables: jsonb("variables").$type<Record<string, string>>().default({}),
    // raw text fallback when no template (only if session window is open)
    body: text("body"),
    runAt: timestamp("run_at", { mode: "date" }).notNull(),
    // queued|processing|sent|failed|skipped|cancelled
    status: text("status").notNull().default("queued"),
    failureReason: text("failure_reason"),
    attempts: integer("attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { mode: "date" }),
    providerMessageId: text("provider_message_id"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgRunAtIdx: index("scheduled_org_runat_idx").on(
      t.organizationId,
      t.status,
      t.runAt,
    ),
    runAtIdx: index("scheduled_runat_idx").on(t.status, t.runAt),
  }),
);

export const broadcast = pgTable("broadcast", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channel: text("channel").notNull().default("whatsapp"),
  templateId: text("template_id").references(() => template.id, {
    onDelete: "set null",
  }),
  channelConnectionId: text("channel_connection_id").references(
    () => channelConnection.id,
    { onDelete: "set null" },
  ),
  // criteria: { tags: [], status: [], lastSeenBeforeDays: N, rawSql: ""... }
  audience: jsonb("audience").$type<Record<string, unknown>>().default({}),
  // default variable map; per-customer variables override
  defaultVariables: jsonb("default_variables")
    .$type<Record<string, string>>()
    .default({}),
  status: text("status").notNull().default("draft"), // draft|scheduled|running|paused|completed|cancelled
  scheduledFor: timestamp("scheduled_for", { mode: "date" }),
  startedAt: timestamp("started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  createdByUserId: text("created_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Operational: webhook idempotency, audit, usage
// ─────────────────────────────────────────────────────────────────────────────

export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    // externally-provided event id (for idempotency)
    externalId: text("external_id").notNull(),
    organizationId: text("organization_id"),
    channelConnectionId: text("channel_connection_id"),
    receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
    status: text("status").notNull().default("received"), // received|processed|duplicate|failed
    error: text("error"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
  },
  (t) => ({
    providerExtUid: uniqueIndex("webhook_event_provider_ext_uidx").on(
      t.provider,
      t.externalId,
    ),
    orgRecvIdx: index("webhook_event_org_recv_idx").on(
      t.organizationId,
      t.receivedAt,
    ),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    target: text("target"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgCreatedIdx: index("audit_log_org_created_idx").on(
      t.organizationId,
      t.createdAt,
    ),
  }),
);

/**
 * Observability + cost control. One row per LLM/embedding call.
 */
export const llmUsage = pgTable(
  "llm_usage",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id"),
    provider: text("provider").notNull(), // groq|gemini|openai
    model: text("model").notNull(),
    purpose: text("purpose").notNull(), // reply|embed|classify|transcribe
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    latencyMs: integer("latency_ms"),
    succeeded: boolean("succeeded").notNull().default(true),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgCreatedIdx: index("llm_usage_org_created_idx").on(
      t.organizationId,
      t.createdAt,
    ),
  }),
);

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    inboundCount: integer("inbound_count").notNull().default(0),
    outboundCount: integer("outbound_count").notNull().default(0),
    uniqueCustomers: integer("unique_customers").notNull().default(0),
    positiveCount: integer("positive_count").notNull().default(0),
    negativeCount: integer("negative_count").notNull().default(0),
    neutralCount: integer("neutral_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgDayUid: uniqueIndex("analytics_daily_org_day_uidx").on(
      t.organizationId,
      t.day,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Platform-level (admin-only) LLM provider credentials
// One row per provider (groq|gemini|openai); secret is AES-GCM encrypted.
// ─────────────────────────────────────────────────────────────────────────────

export const platformLlmCredential = pgTable("platform_llm_credential", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  defaultModel: text("default_model").notNull(),
  // JSON blob { apiKey, orgId?, baseUrl? }
  secretsCiphertext: text("secrets_ciphertext"),
  priority: integer("priority").notNull().default(100),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
