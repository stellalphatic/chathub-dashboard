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

/** Better Auth — user */
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

/** Better Auth — session */
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

/** Better Auth — account (credentials / OAuth) */
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

/** Better Auth — email verification / magic links */
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

/** Tenant (business) */
export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    /** Plain secret for n8n ingest (rotate from admin when needed). */
    ingestSecret: text("ingest_secret").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
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
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgUserUid: uniqueIndex("organization_member_org_user_uidx").on(
      t.organizationId,
      t.userId,
    ),
  }),
);

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    displayName: text("display_name"),
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
    direction: text("direction").notNull(),
    body: text("body").notNull(),
    providerMessageId: text("provider_message_id"),
    sentiment: text("sentiment"),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orgCustomerCreatedIdx: index("message_org_customer_created_idx").on(
      t.organizationId,
      t.customerId,
      t.createdAt,
    ),
    orgProviderUid: uniqueIndex("message_org_provider_uidx").on(
      t.organizationId,
      t.providerMessageId,
    ),
  }),
);

/** Optional hybrid integrations — treat config as sensitive in production */
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
