import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  channelConnection,
  conversation,
  customer,
  message,
  template as templateTable,
} from "@/db/schema";
import { loadChannelConnection } from "@/lib/providers/sender-factory";
import { channelSendRateLimit } from "@/lib/rate-limit";
import { inspectOutbound } from "@/lib/llm/guardrails";
import { decideSend } from "@/lib/window-24h";

export type QueueOutboundParams = {
  organizationId: string;
  conversationId: string;
  /** Human sender (agent) or null if bot. */
  sentByUserId?: string | null;
  sentByBot?: boolean;
  body?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
  // Optional override of channel_connection (defaults to the conversation's).
  channelConnectionId?: string;
};

/**
 * Persist an outbound message row in "queued" state and return the ids.
 * The actual network send happens in the outbound-send worker, OR (when
 * `sendNow=true`) is performed synchronously here — useful for UI replies
 * where the agent wants an instant error.
 */
export async function queueOutboundMessage(
  p: QueueOutboundParams,
  opts: { sendNow?: boolean } = {},
): Promise<{ messageId: string; status: string; error?: string }> {
  // 1. Load conversation, customer, channel_connection.
  const [conv] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.id, p.conversationId),
        eq(conversation.organizationId, p.organizationId),
      ),
    )
    .limit(1);
  if (!conv) throw new Error("conversation not found");

  const [cust] = await db
    .select()
    .from(customer)
    .where(eq(customer.id, conv.customerId))
    .limit(1);
  if (!cust) throw new Error("customer not found");

  const channelConnId = p.channelConnectionId ?? conv.channelConnectionId;
  if (!channelConnId) {
    throw new Error("conversation has no channel connection");
  }
  const [conn] = await db
    .select()
    .from(channelConnection)
    .where(eq(channelConnection.id, channelConnId))
    .limit(1);
  if (!conn) throw new Error("channel_connection not found");

  // 2. 24h window + template policy.
  const decision = decideSend(conv.channel, conv.lastInboundAt);
  const usingTemplate = !!p.templateId;

  if (decision.kind === "template_required" && !usingTemplate) {
    return {
      messageId: "",
      status: "failed",
      error:
        "Outside 24h customer service window. Use an approved template instead.",
    };
  }

  let finalBody = p.body ?? "";
  let templateName: string | undefined;
  let templateLang = "en";
  if (usingTemplate && p.templateId) {
    const [tpl] = await db
      .select()
      .from(templateTable)
      .where(
        and(
          eq(templateTable.id, p.templateId),
          eq(templateTable.organizationId, p.organizationId),
        ),
      )
      .limit(1);
    if (!tpl) {
      return { messageId: "", status: "failed", error: "template not found" };
    }
    if (tpl.status !== "approved") {
      return {
        messageId: "",
        status: "failed",
        error: `template "${tpl.name}" is not approved`,
      };
    }
    templateName = tpl.name;
    templateLang = tpl.language;
    // render a preview body so the UI shows something sensible
    finalBody = renderTemplatePreview(
      tpl.bodyPreview,
      p.templateVariables ?? {},
    );
  } else {
    // Guardrail sanitization (agent/bot freeform).
    const g = inspectOutbound(finalBody, {
      maxLen: conv.channel === "instagram" ? 950 : 3800,
    });
    if (g.blocked) {
      return {
        messageId: "",
        status: "failed",
        error: `message blocked by guardrail: ${g.reason}`,
      };
    }
    finalBody = g.sanitized;
  }

  if (!finalBody && !usingTemplate) {
    return { messageId: "", status: "failed", error: "empty body" };
  }

  // 3. Insert message row in `queued` state.
  const messageId = randomUUID();
  const now = new Date();
  await db.insert(message).values({
    id: messageId,
    organizationId: p.organizationId,
    customerId: conv.customerId,
    conversationId: conv.id,
    channel: conv.channel,
    direction: "outbound",
    contentType: usingTemplate ? "template" : "text",
    body: finalBody,
    sentByUserId: p.sentByUserId ?? null,
    sentByBot: p.sentByBot ?? false,
    templateId: p.templateId ?? null,
    status: "queued",
    createdAt: now,
  });

  // 4. Optionally send right now (used for sync UI replies).
  if (!opts.sendNow) {
    return { messageId, status: "queued" };
  }

  return await sendQueuedMessage({
    messageId,
    conversationId: conv.id,
    organizationId: p.organizationId,
    channelConnectionId: conn.id,
    toPhoneE164: cust.phoneE164.startsWith("ext:") ? undefined : cust.phoneE164,
    toExternalId: extractExternalId(cust),
    body: finalBody,
    template:
      usingTemplate && templateName
        ? {
            name: templateName,
            language: templateLang,
            variables: p.templateVariables ?? {},
          }
        : undefined,
  });
}

export function renderTemplatePreview(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, k: string) => vars[k] ?? `{{${k}}}`);
}

function extractExternalId(
  cust: typeof customer.$inferSelect,
): string | undefined {
  if (cust.phoneE164.startsWith("ext:")) {
    // ext:instagram:12345  → 12345
    return cust.phoneE164.split(":", 3)[2];
  }
  const profile = (cust.profile ?? {}) as Record<string, unknown>;
  for (const key of ["instagram_id", "messenger_id", "psid", "ig_user_id"]) {
    if (typeof profile[key] === "string") return profile[key] as string;
  }
  return undefined;
}

/**
 * Perform the actual network send and update the message row.
 * Called by the outbound-send worker AND (optionally) queueOutboundMessage.
 */
export async function sendQueuedMessage(p: {
  messageId: string;
  conversationId: string;
  organizationId: string;
  channelConnectionId: string;
  toPhoneE164?: string;
  toExternalId?: string;
  body: string;
  template?: { name: string; language: string; variables: Record<string, string> };
}): Promise<{ messageId: string; status: string; error?: string }> {
  // Rate-limit per-connection to respect provider caps (WhatsApp ~80/s).
  const rl = await channelSendRateLimit(p.channelConnectionId);
  if (!rl.allowed) {
    // Leave it queued; worker will pick it up on the next tick.
    return { messageId: p.messageId, status: "queued", error: "rate_limited" };
  }

  await db
    .update(message)
    .set({ status: "sending" })
    .where(eq(message.id, p.messageId));

  try {
    const conn = await loadChannelConnection(p.channelConnectionId);
    let providerMessageId: string;
    if (p.template) {
      if (!conn.sender.sendTemplate) {
        throw new Error("template send not supported by this provider");
      }
      const res = await conn.sender.sendTemplate({
        toPhoneE164: p.toPhoneE164,
        toExternalId: p.toExternalId,
        templateName: p.template.name,
        language: p.template.language,
        variables: p.template.variables,
      });
      providerMessageId = res.providerMessageId;
    } else {
      const res = await conn.sender.sendText({
        toPhoneE164: p.toPhoneE164,
        toExternalId: p.toExternalId,
        body: p.body,
      });
      providerMessageId = res.providerMessageId;
    }

    await db
      .update(message)
      .set({ status: "sent", providerMessageId })
      .where(eq(message.id, p.messageId));

    await db
      .update(conversation)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: p.body.slice(0, 140),
        updatedAt: new Date(),
      })
      .where(eq(conversation.id, p.conversationId));

    return { messageId: p.messageId, status: "sent" };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await db
      .update(message)
      .set({ status: "failed", failureReason: err })
      .where(eq(message.id, p.messageId));
    return { messageId: p.messageId, status: "failed", error: err };
  }
}
