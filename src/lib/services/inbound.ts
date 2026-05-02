import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  channelConnection,
  conversation,
  customer,
  message,
  webhookEvent,
} from "@/db/schema";
import { decryptJSON } from "@/lib/encryption";
import {
  fetchInstagramScopedParticipant,
  resolveInstagramPageAccessToken,
} from "@/lib/providers/meta-resolve";
import type { NormalizedInboundMessage } from "@/lib/providers/types";

export type IngestedInbound = {
  organizationId: string;
  channelConnectionId: string;
  customerId: string;
  conversationId: string;
  messageId: string;
  duplicate: boolean;
  channel: string;
};

/**
 * Upsert a webhook event for idempotency, then upsert customer + conversation
 * + message. Everything is scoped by organization — never cross-tenant.
 */
export async function ingestInboundMessage(opts: {
  /** Route by provider + channelExternalId to an org + channel_connection. */
  m: NormalizedInboundMessage;
  /**
   * When Meta (or another provider) posts to `/webhooks/.../{connectionId}`,
   * pin routing to that row so multiple tenants on the same channel never
   * share a fallback match.
   */
  forcedChannelConnectionId?: string;
}): Promise<IngestedInbound | null> {
  const m = opts.m;

  // 1. Find channel_connection — prefer explicit webhook target (SaaS-safe).
  let conn:
    | (typeof channelConnection.$inferSelect)
    | undefined;

  if (opts.forcedChannelConnectionId) {
    [conn] = await db
      .select()
      .from(channelConnection)
      .where(eq(channelConnection.id, opts.forcedChannelConnectionId))
      .limit(1);
    if (
      conn &&
      (conn.provider !== m.provider ||
        (m.channel && conn.channel !== m.channel))
    ) {
      console.warn(
        `[inbound] forcedChannelConnectionId=${opts.forcedChannelConnectionId} mismatches payload provider/channel; dropping`,
      );
      return null;
    }
    if (opts.forcedChannelConnectionId && !conn) {
      console.warn(
        `[inbound] unknown forcedChannelConnectionId=${opts.forcedChannelConnectionId}`,
      );
      return null;
    }
  }

  if (!conn && m.channelExternalId) {
    [conn] = await db
      .select()
      .from(channelConnection)
      .where(
        and(
          eq(channelConnection.provider, m.provider),
          eq(channelConnection.externalId, m.channelExternalId),
        ),
      )
      .limit(1);
  }
  if (!conn && !opts.forcedChannelConnectionId) {
    // Fallback: any connection of this provider + channel (single-tenant dev
    // or legacy `/api/webhooks/meta` without path id — avoid for multi-tenant prod).
    [conn] = await db
      .select()
      .from(channelConnection)
      .where(
        and(
          eq(channelConnection.provider, m.provider),
          eq(channelConnection.channel, m.channel),
        ),
      )
      .limit(1);
  }
  if (!conn) {
    console.warn(
      `[inbound] no channel_connection for ${m.provider}/${m.channelExternalId}; dropping`,
    );
    return null;
  }

  const organizationId = conn.organizationId;

  let inboundDisplayName = m.displayName ?? undefined;
  let inboundProfilePicUrl: string | null = null;
  if (
    m.provider === "meta" &&
    m.channel === "instagram" &&
    m.fromExternalId &&
    conn.secretsCiphertext
  ) {
    try {
      const sec = decryptJSON<Record<string, string>>(conn.secretsCiphertext);
      const cfg = (conn.config ?? {}) as Record<string, unknown>;
      const igBiz = String(cfg.igUserId ?? conn.externalId ?? "").trim();
      if (igBiz) {
        let tok = String(sec.accessToken ?? "").trim();
        const pageTok = await resolveInstagramPageAccessToken(tok, igBiz);
        if (pageTok) tok = pageTok;
        const part = await fetchInstagramScopedParticipant(tok, String(m.fromExternalId));
        if (part?.label) inboundDisplayName = inboundDisplayName ?? part.label;
        if (part?.profilePicUrl) inboundProfilePicUrl = part.profilePicUrl;
      }
    } catch (e) {
      console.warn("[inbound] instagram profile enrich failed:", e);
    }
  }

  // 2. Idempotency — have we seen this externalMessageId?
  try {
    await db.insert(webhookEvent).values({
      id: randomUUID(),
      provider: m.provider,
      externalId: m.externalMessageId,
      organizationId,
      channelConnectionId: conn.id,
      status: "received",
      payload: m.raw,
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return {
        organizationId,
        channelConnectionId: conn.id,
        customerId: "",
        conversationId: "",
        messageId: "",
        duplicate: true,
        channel: m.channel,
      };
    }
    throw e;
  }

  // 3. Upsert customer by phone (WhatsApp) or profile.externalId (IG/FB).
  const now = new Date();
  const phoneE164 = m.fromPhoneE164;
  const externalId = m.fromExternalId;

  let customerId: string;
  if (phoneE164) {
    const [existing] = await db
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          eq(customer.organizationId, organizationId),
          eq(customer.phoneE164, phoneE164),
        ),
      )
      .limit(1);
    if (existing) {
      customerId = existing.id;
      await db
        .update(customer)
        .set({
          lastContactedAt: now,
          updatedAt: now,
          ...(inboundDisplayName ? { displayName: inboundDisplayName } : {}),
        })
        .where(eq(customer.id, existing.id));
    } else {
      customerId = randomUUID();
      await db.insert(customer).values({
        id: customerId,
        organizationId,
        phoneE164,
        displayName: inboundDisplayName ?? null,
        lastContactedAt: now,
      });
    }
  } else if (externalId) {
    // For IG/FB we put the external id into the unique "phone" slot with a
    // sentinel prefix so the unique index still covers us.
    const phoneSurrogate = `ext:${m.channel}:${externalId}`;
    const [existing] = await db
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          eq(customer.organizationId, organizationId),
          eq(customer.phoneE164, phoneSurrogate),
        ),
      )
      .limit(1);
    if (existing) {
      customerId = existing.id;
      let profilePatch: Record<string, unknown> | undefined;
      if (m.channel === "instagram" && inboundProfilePicUrl) {
        const [cur] = await db
          .select({ profile: customer.profile })
          .from(customer)
          .where(eq(customer.id, existing.id))
          .limit(1);
        const prev = (cur?.profile ?? {}) as Record<string, unknown>;
        if (prev.instagram_profile_pic !== inboundProfilePicUrl) {
          profilePatch = { ...prev, instagram_profile_pic: inboundProfilePicUrl };
        }
      }
      await db
        .update(customer)
        .set({
          lastContactedAt: now,
          updatedAt: now,
          ...(inboundDisplayName ? { displayName: inboundDisplayName } : {}),
          ...(profilePatch ? { profile: profilePatch } : {}),
        })
        .where(eq(customer.id, existing.id));
    } else {
      customerId = randomUUID();
      await db.insert(customer).values({
        id: customerId,
        organizationId,
        phoneE164: phoneSurrogate,
        displayName: inboundDisplayName ?? null,
        lastContactedAt: now,
        profile: {
          [`${m.channel}_id`]: externalId,
          ...(m.channel === "instagram" && inboundProfilePicUrl
            ? { instagram_profile_pic: inboundProfilePicUrl }
            : {}),
        },
      });
    }
  } else {
    console.warn("[inbound] message without phone or externalId; dropping");
    return null;
  }

  // 4. Upsert conversation (customer + channel).
  let conversationId: string;
  const [existingConv] = await db
    .select({ id: conversation.id, mode: conversation.mode })
    .from(conversation)
    .where(
      and(
        eq(conversation.organizationId, organizationId),
        eq(conversation.customerId, customerId),
        eq(conversation.channel, m.channel),
      ),
    )
    .limit(1);
  if (existingConv) {
    conversationId = existingConv.id;
    await db
      .update(conversation)
      .set({
        lastInboundAt: now,
        lastMessageAt: now,
        lastMessagePreview: m.body.slice(0, 140),
        channelConnectionId: conn.id,
        updatedAt: now,
      })
      .where(eq(conversation.id, existingConv.id));
  } else {
    conversationId = randomUUID();
    await db.insert(conversation).values({
      id: conversationId,
      organizationId,
      customerId,
      channel: m.channel,
      channelConnectionId: conn.id,
      mode: "bot",
      status: "open",
      lastInboundAt: now,
      lastMessageAt: now,
      lastMessagePreview: m.body.slice(0, 140),
    });
  }

  // 5. Insert message.
  const messageId = randomUUID();
  try {
    await db.insert(message).values({
      id: messageId,
      organizationId,
      customerId,
      conversationId,
      channel: m.channel,
      direction: "inbound",
      contentType: m.contentType,
      body: m.body,
      mediaUrl: m.mediaUrl ?? null,
      mediaMimeType: m.mediaMimeType ?? null,
      providerMessageId: m.externalMessageId,
      status: "received",
      rawPayload: m.raw,
      createdAt: new Date(m.receivedAt),
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return {
        organizationId,
        channelConnectionId: conn.id,
        customerId,
        conversationId,
        messageId: "",
        duplicate: true,
        channel: m.channel,
      };
    }
    throw e;
  }

  return {
    organizationId,
    channelConnectionId: conn.id,
    customerId,
    conversationId,
    messageId,
    duplicate: false,
    channel: m.channel,
  };
}
