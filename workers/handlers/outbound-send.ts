import type { Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  channelConnection,
  conversation,
  customer,
  message,
  template as templateTable,
} from "../../src/db/schema";
import type { OutboundSendJob } from "../../src/lib/queue";
import { sendQueuedMessage } from "../../src/lib/services/outbound";

export async function handleOutboundSend(job: Job<OutboundSendJob>) {
  const p = job.data;

  const [msg] = await db
    .select()
    .from(message)
    .where(
      and(
        eq(message.id, p.messageId),
        eq(message.organizationId, p.organizationId),
      ),
    )
    .limit(1);
  if (!msg) throw new Error("message row missing");
  if (msg.status !== "queued") {
    return { skipped: true, reason: `status=${msg.status}` };
  }
  if (!msg.conversationId) throw new Error("message has no conversation");

  const [conv] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, msg.conversationId))
    .limit(1);
  if (!conv) throw new Error("conversation missing");

  const [cust] = await db
    .select()
    .from(customer)
    .where(eq(customer.id, conv.customerId))
    .limit(1);
  if (!cust) throw new Error("customer missing");

  const channelConnId = conv.channelConnectionId;
  if (!channelConnId) throw new Error("no channel connection");
  const [conn] = await db
    .select()
    .from(channelConnection)
    .where(eq(channelConnection.id, channelConnId))
    .limit(1);
  if (!conn) throw new Error("channel_connection missing");

  let tpl:
    | { name: string; language: string; variables: Record<string, string> }
    | undefined;
  if (msg.templateId) {
    const [t] = await db
      .select()
      .from(templateTable)
      .where(eq(templateTable.id, msg.templateId))
      .limit(1);
    if (t) {
      tpl = {
        name: t.name,
        language: t.language,
        variables: (p.templateVariables ?? {}) as Record<string, string>,
      };
    }
  }

  return sendQueuedMessage({
    messageId: msg.id,
    conversationId: conv.id,
    organizationId: p.organizationId,
    channelConnectionId: conn.id,
    toPhoneE164: cust.phoneE164.startsWith("ext:") ? undefined : cust.phoneE164,
    toExternalId: cust.phoneE164.startsWith("ext:")
      ? cust.phoneE164.split(":", 3)[2]
      : undefined,
    body: msg.body,
    template: tpl,
  });
}
