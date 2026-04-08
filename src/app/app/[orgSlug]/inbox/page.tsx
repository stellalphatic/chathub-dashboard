import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customer, message, organization } from "@/db/schema";
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

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);
  if (!org) notFound();

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

  return (
    <InboxAutoRefresh>
      <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(0,14rem)_1fr] xl:grid-cols-[minmax(0,18rem)_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-zinc-900/50 overflow-hidden flex flex-col">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Chats
            </p>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
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
                        active && "bg-emerald-500/10 border-l-2 border-emerald-500",
                      )}
                    >
                      <p className="font-medium text-white truncate">
                        {cust.displayName || "Unknown"}
                      </p>
                      <p className="text-xs font-mono text-zinc-500 truncate">
                        {cust.phoneE164}
                      </p>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="flex flex-col rounded-2xl border border-white/10 bg-[#0b141a] min-h-[32rem] overflow-hidden shadow-inner">
          <header className="border-b border-white/10 px-4 py-3 bg-zinc-900/40">
            {activeCustomer ? (
              <div>
                <p className="font-semibold text-white">
                  {activeCustomer.displayName || "Customer"}
                </p>
                <p className="text-xs font-mono text-emerald-400/90">
                  {activeCustomer.phoneE164}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Select a conversation</p>
            )}
          </header>
          <div
            className="flex-1 overflow-y-auto px-3 py-4 space-y-2"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.06), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.05), transparent 35%)",
            }}
          >
            {thread.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-12">
                {activeCustomer
                  ? "No messages for this thread yet."
                  : "Waiting for the first inbound message."}
              </p>
            ) : (
              thread.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.direction === "outbound" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-md",
                      m.direction === "outbound"
                        ? "bg-emerald-700/90 text-white rounded-br-md"
                        : "bg-zinc-800 text-zinc-100 rounded-bl-md border border-white/5",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="mt-1 text-[10px] opacity-60 text-right">
                      {m.createdAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </InboxAutoRefresh>
  );
}
