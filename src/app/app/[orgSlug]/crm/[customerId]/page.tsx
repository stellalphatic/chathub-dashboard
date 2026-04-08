import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CustomerEditForm } from "@/components/crm/customer-edit-form";
import { assertOrgMember } from "@/lib/org-access";
import { db } from "@/db";
import { customer } from "@/db/schema";

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

  const initial = {
    id: row.id,
    displayName: row.displayName ?? "",
    phoneE164: row.phoneE164,
    meetingBooked: row.meetingBooked,
    meetingTime: row.meetingTime ?? "",
    metadataJson: JSON.stringify(row.metadata ?? {}, null, 2),
    lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/app/${orgSlug}/crm`}
          className="text-zinc-500 transition hover:text-white"
        >
          ← CRM
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="font-medium text-white truncate max-w-[12rem] sm:max-w-md">
          {row.displayName || row.phoneE164}
        </span>
      </div>

      <CustomerEditForm orgSlug={orgSlug} initial={initial} />
    </div>
  );
}
