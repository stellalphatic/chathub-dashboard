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
}): Promise<IngestedInbound | null> {
  const m = opts.m;

  // 1. Find the matching channel_connection by provider + externalId.
  let conn:
    | (typeof channelConnection.$inferSelect)
    | undefined;

  if (m.channelExternalId) {
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
  if (!conn) {
    // Fallback: any connection of this provider + channel (single-tenant dev).
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
          ...(m.displayName ? { displayName: m.displayName } : {}),
        })
        .where(eq(customer.id, existing.id));
    } else {
      customerId = randomUUID();
      await db.insert(customer).values({
        id: customerId,
        organizationId,
        phoneE164,
        displayName: m.displayName ?? null,
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
      await db
        .update(customer)
        .set({
          lastContactedAt: now,
          updatedAt: now,
          ...(m.displayName ? { displayName: m.displayName } : {}),
        })
        .where(eq(customer.id, existing.id));
    } else {
      customerId = randomUUID();
      await db.insert(customer).values({
        id: customerId,
        organizationId,
        phoneE164: phoneSurrogate,
        displayName: m.displayName ?? null,
        lastContactedAt: now,
        profile: { [`${m.channel}_id`]: externalId },
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
