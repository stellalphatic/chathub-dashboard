import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { CustomerEditForm } from "@/components/crm/customer-edit-form";
import { assertOrgMember } from "@/lib/org-access";
import { db } from "@/db";
import { customer, message } from "@/db/schema";

export default async function CrmCustomerPage({
  params,
}: {
  params: Promise<{ orgSlug: string; customerId: string }>;
}) {
  const { orgSlug, customerId } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const [row] = await db
    .select()
    .from(customer)
    .where(
      and(eq(customer.id, customerId), eq(customer.organizationId, org.id)),
    )
    .limit(1);

  if (!row) notFound();

  const messages = await db
    .select({
      id: message.id,
      direction: message.direction,
      body: message.body,
      channel: message.channel,
      createdAt: message.createdAt,
      sentByBot: message.sentByBot,
      status: message.status,
    })
    .from(message)
    .where(eq(message.customerId, row.id))
    .orderBy(desc(message.createdAt))
    .limit(200);

  const history = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    channel: m.channel,
    createdAt: m.createdAt.toISOString(),
    sentByBot: m.sentByBot,
    status: m.status,
  }));

  const initial = {
    id: row.id,
    displayName: row.displayName ?? "",
    phoneE164: row.phoneE164,
    email: row.email ?? "",
    status: row.status,
    tags: (row.tags ?? []) as string[],
    meetingBooked: row.meetingBooked,
    meetingTime: row.meetingTime ?? "",
    metadataJson: JSON.stringify(row.metadata ?? {}, null, 2),
    profileJson: JSON.stringify(row.profile ?? {}, null, 2),
    lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${orgSlug}/crm`}
        className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] transition-colors hover:text-[rgb(var(--fg))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Customers
      </Link>
      <CustomerEditForm orgSlug={orgSlug} initial={initial} history={history} />
    </div>
  );
}
