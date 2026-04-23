import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { ThreadMessages } from "@/components/inbox/thread-messages";
import { Composer } from "@/components/inbox/composer";
import { ConversationHeader } from "@/components/inbox/conversation-header";
import { db } from "@/db";
import { conversation, customer, message, template } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import { cn } from "@/lib/utils";
import { InboxAutoRefresh } from "./inbox-auto-refresh";

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

  // List of conversations (one row per customer+channel) with joined customer.
  const convs = await db
    .select({
      id: conversation.id,
      channel: conversation.channel,
      mode: conversation.mode,
      status: conversation.status,
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
    .orderBy(
      desc(conversation.lastMessageAt),
      desc(conversation.updatedAt),
    );

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
  }));

  return (
    <InboxAutoRefresh>
      <div className="grid min-h-[40rem] gap-4 lg:grid-cols-[minmax(0,18rem)_1fr] xl:grid-cols-[minmax(0,22rem)_1fr]">
        <aside className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Chats ({convs.length})
            </p>
          </div>
          <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
            {convs.length === 0 ? (
              <li className="p-4 text-sm text-zinc-500">
                No conversations yet. Connect a channel under{" "}
                <Link href={`/app/${orgSlug}/channels`} className="text-emerald-400 hover:underline">
                  Channels
                </Link>
                .
              </li>
            ) : (
              convs.map((cv) => {
                const isActive = cv.id === selectedId;
                return (
                  <li key={cv.id}>
                    <Link
                      href={`/app/${orgSlug}/inbox?c=${cv.id}`}
                      scroll={false}
                      className={cn(
                        "block px-4 py-3 transition-colors hover:bg-white/5",
                        isActive && "border-l-2 border-emerald-500 bg-emerald-500/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {cv.displayName ||
                            (cv.phoneE164?.startsWith("ext:")
                              ? "Customer"
                              : cv.phoneE164) ||
                            "Unknown"}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            cv.channel === "whatsapp" &&
                              "bg-emerald-500/10 text-emerald-300",
                            cv.channel === "instagram" &&
                              "bg-fuchsia-500/10 text-fuchsia-300",
                            cv.channel === "messenger" &&
                              "bg-blue-500/10 text-blue-300",
                          )}
                        >
                          {cv.channel}
                        </span>
                      </div>
                      <p className="truncate text-xs text-zinc-500">
                        {cv.preview ?? cv.phoneE164}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                        <span
                          className={cn(
                            "rounded px-1",
                            cv.mode === "bot"
                              ? "bg-blue-500/10 text-blue-300"
                              : "bg-amber-500/10 text-amber-300",
                          )}
                        >
                          {cv.mode}
                        </span>
                        {cv.lastMessageAt && (
                          <span>{timeAgo(cv.lastMessageAt)}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="flex min-h-[40rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b141a] shadow-inner">
          {active ? (
            <>
              <ConversationHeader
                orgSlug={orgSlug}
                conversationId={active.id}
                mode={active.mode}
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
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500">
              Select a conversation to view it.
            </div>
          )}
        </section>
      </div>
    </InboxAutoRefresh>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}
