import Link from "next/link";
import { Suspense } from "react";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { CrmListClient } from "@/components/crm/crm-list-client";
import { assertOrgMember } from "@/lib/org-access";
import { db } from "@/db";
import { customer, message } from "@/db/schema";

export default async function CrmListPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgSlug } = await params;
  const { q } = await searchParams;
  const { org } = await assertOrgMember(orgSlug);

  const term = q?.trim() ?? "";
  const searchPattern = term ? `%${term}%` : null;

  const whereClause = searchPattern
    ? and(
        eq(customer.organizationId, org.id),
        or(
          ilike(customer.phoneE164, searchPattern),
          ilike(sql<string>`coalesce(${customer.displayName}, '')`, searchPattern),
          ilike(sql<string>`coalesce(${customer.email}, '')`, searchPattern),
        ),
      )
    : eq(customer.organizationId, org.id);

  const rows = await db
    .select()
    .from(customer)
    .where(whereClause)
    .orderBy(desc(customer.lastContactedAt), desc(customer.createdAt));

  const countRows = await db
    .select({
      customerId: message.customerId,
      n: count(),
    })
    .from(message)
    .where(eq(message.organizationId, org.id))
    .groupBy(message.customerId);

  const msgCount = new Map(countRows.map((r) => [r.customerId, r.n]));

  const payload = rows.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    phoneE164: c.phoneE164,
    email: c.email,
    tags: (c.tags ?? []) as string[],
    status: c.status,
    lastContactedAt: c.lastContactedAt?.toISOString() ?? null,
    meetingBooked: c.meetingBooked,
    meetingTime: c.meetingTime,
    createdAt: c.createdAt.toISOString(),
    messageCount: msgCount.get(c.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[rgb(var(--fg))]">
            Customers
          </h2>
          <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
            Contacts synced from WhatsApp, Instagram, and Messenger. Switch views, filter by
            status or tags, and manage pipelines from one screen.
          </p>
        </div>
        <p className="text-xs text-[rgb(var(--fg-subtle))]">
          Tip: open{" "}
          <Link
            href={`/app/${orgSlug}/inbox`}
            className="text-[rgb(var(--accent))] hover:underline"
          >
            Inbox
          </Link>{" "}
          for live threads.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-2xl bg-[rgb(var(--surface-2))]" />
        }
      >
        <CrmListClient orgSlug={orgSlug} initialQuery={term} rows={payload} />
      </Suspense>
    </div>
  );
}
