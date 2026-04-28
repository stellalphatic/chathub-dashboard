import { asc, desc, eq } from "drizzle-orm";
import { Composer } from "@/components/inbox/composer";
import { ConversationHeader } from "@/components/inbox/conversation-header";
import {
  InboxEmptyPane,
  InboxSidebar,
  LiveIndicator,
  type ConversationListItem,
} from "@/components/inbox/inbox-client";
import { ThreadMessages } from "@/components/inbox/thread-messages";
import { db } from "@/db";
import { conversation, customer, message, template } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import { cn } from "@/lib/utils";

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { orgSlug } = await params;
  const { c } = await searchParams;

  const { org } = await assertOrgMember(orgSlug);

  const convs = await db
    .select({
      id: conversation.id,
      channel: conversation.channel,
      mode: conversation.mode,
      status: conversation.status,
      unreadCount: conversation.unreadCount,
      lastInboundAt: conversation.lastInboundAt,
      lastMessageAt: conversation.lastMessageAt,
      preview: conversation.lastMessagePreview,
      customerId: conversation.customerId,
      phoneE164: customer.phoneE164,
      displayName: customer.displayName,
    })
    .from(conversation)
    .innerJoin(customer, eq(conversation.customerId, customer.id))
    .where(eq(conversation.organizationId, org.id))
    .orderBy(desc(conversation.lastMessageAt), desc(conversation.updatedAt));

  const selectedId = c && convs.some((x) => x.id === c) ? c : convs[0]?.id;
  const active = convs.find((x) => x.id === selectedId);

  const thread = selectedId
    ? await db
        .select()
        .from(message)
        .where(eq(message.conversationId, selectedId))
        .orderBy(asc(message.createdAt))
    : [];

  const approvedTemplates = await db
    .select({
      id: template.id,
      name: template.name,
      language: template.language,
      bodyPreview: template.bodyPreview,
      variables: template.variables,
    })
    .from(template)
    .where(eq(template.organizationId, org.id));

  const threadMessages = thread.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    timeLabel: m.createdAt.toLocaleString(),
    sentByBot: m.sentByBot,
    status: m.status,
    contentType: m.contentType,
    mediaUrl: m.mediaUrl,
    mediaMimeType: m.mediaMimeType,
  }));

  const sidebarConvs: ConversationListItem[] = convs.map((c) => ({
    id: c.id,
    channel: c.channel,
    mode: c.mode,
    status: c.status,
    unreadCount: c.unreadCount ?? 0,
    lastInboundAt: c.lastInboundAt,
    lastMessageAt: c.lastMessageAt,
    preview: c.preview,
    displayName: c.displayName,
    phoneE164: c.phoneE164,
  }));

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[36rem] flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-[rgb(var(--fg))]">
          Inbox
        </h2>
        <LiveIndicator />
      </div>

      {/*
        Mobile-first WhatsApp layout:
        - On lg+ screens it's the classic 2-pane (list left, thread right).
        - On <lg screens we stack: when a conversation is selected, the
          list disappears and the thread takes the full width. The
          ConversationHeader's back button drops the user back to the list.
      */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,20rem)_1fr] xl:grid-cols-[minmax(0,24rem)_1fr]">
        <div
          className={cn(
            "min-h-0 lg:block",
            active ? "hidden" : "block",
          )}
        >
          <InboxSidebar
            orgSlug={orgSlug}
            conversations={sidebarConvs}
            selectedId={selectedId}
          />
        </div>

        <section
          className={cn(
            "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]",
            active ? "flex" : "hidden lg:flex",
          )}
        >
          {active ? (
            <>
              <ConversationHeader
                orgSlug={orgSlug}
                conversationId={active.id}
                mode={active.mode}
                status={active.status}
                channel={active.channel}
                lastInboundAt={active.lastInboundAt}
                displayName={active.displayName}
                phoneE164={active.phoneE164}
              />
              <ThreadMessages
                threadKey={selectedId ?? "none"}
                messages={threadMessages}
                emptyLabel="No messages yet — once the customer writes, their message will appear here."
              />
              <Composer
                orgSlug={orgSlug}
                conversationId={active.id}
                channel={active.channel}
                lastInboundAt={active.lastInboundAt}
                templates={approvedTemplates.map((t) => ({
                  id: t.id,
                  name: t.name,
                  language: t.language,
                  bodyPreview: t.bodyPreview,
                  variables: (t.variables ?? []) as string[],
                }))}
              />
            </>
          ) : (
            <InboxEmptyPane convCount={sidebarConvs.length} />
          )}
        </section>
      </div>
    </div>
  );
}
