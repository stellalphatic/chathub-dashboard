import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { ThreadMessages } from "@/components/inbox/thread-messages";
import { db } from "@/db";
import { customer, message } from "@/db/schema";
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

  const customersList = await db
    .select()
    .from(customer)
    .where(eq(customer.organizationId, org.id))
    .orderBy(desc(customer.lastContactedAt), desc(customer.createdAt));

  const selectedId =
    c && customersList.some((x) => x.id === c) ? c : customersList[0]?.id;

  const thread = selectedId
    ? await db
        .select()
        .from(message)
        .where(eq(message.customerId, selectedId))
        .orderBy(asc(message.createdAt))
    : [];

  const activeCustomer = customersList.find((x) => x.id === selectedId);

  const threadMessages = thread.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    timeLabel: m.createdAt.toLocaleString(),
  }));

  return (
    <InboxAutoRefresh>
      <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(0,14rem)_1fr] xl:grid-cols-[minmax(0,18rem)_1fr]">
        <aside className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Chats
            </p>
          </div>
          <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
            {customersList.length === 0 ? (
              <li className="p-4 text-sm text-zinc-500">
                No customers yet. POST to{" "}
                <code className="text-emerald-400">/api/v1/ingest</code> from
                n8n.
              </li>
            ) : (
              customersList.map((cust) => {
                const active = cust.id === selectedId;
                return (
                  <li key={cust.id}>
                    <Link
                      href={`/app/${orgSlug}/inbox?c=${cust.id}`}
                      scroll={false}
                      className={cn(
                        "block px-4 py-3 transition-colors hover:bg-white/5",
                        active && "border-l-2 border-emerald-500 bg-emerald-500/10",
                      )}
                    >
                      <p className="truncate font-medium text-white">
                        {cust.displayName || "Unknown"}
                      </p>
                      <p className="truncate font-mono text-xs text-zinc-500">
                        {cust.phoneE164}
                      </p>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b141a] shadow-inner">
          <header className="border-b border-white/10 bg-zinc-900/40 px-4 py-3">
            {activeCustomer ? (
              <div>
                <p className="font-semibold text-white">
                  {activeCustomer.displayName || "Customer"}
                </p>
                <p className="font-mono text-xs text-emerald-400/90">
                  {activeCustomer.phoneE164}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Select a conversation</p>
            )}
          </header>
          <ThreadMessages
            threadKey={selectedId ?? "none"}
            messages={threadMessages}
            emptyLabel={
              activeCustomer
                ? "No messages for this thread yet."
                : "Waiting for the first inbound message."
            }
          />
        </section>
      </div>
    </InboxAutoRefresh>
  );
}
