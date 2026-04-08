import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getOrganizationAdmin } from "@/app/admin/actions";
import { AddMemberForm } from "./add-member-form";
import { ProvisionClientForm } from "./provision-client-form";
import { db } from "@/db";
import { organizationMember, user as userTable } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OrganizationAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrganizationAdmin(id);
  if (!org) notFound();

  const members = await db
    .select({
      email: userTable.email,
      name: userTable.name,
      role: organizationMember.role,
    })
    .from(organizationMember)
    .innerJoin(userTable, eq(organizationMember.userId, userTable.id))
    .where(eq(organizationMember.organizationId, org.id));

  return (
    <div className="space-y-8">
      <Link
        href="/admin"
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        ← Businesses
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">{org.name}</h1>
        <p className="font-mono text-sm text-emerald-400 break-all">{org.slug}</p>
        <p className="text-xs text-zinc-500 sm:text-sm">
          <span className="font-mono text-zinc-400">organization.id</span> for
          n8n / Postgres:{" "}
          <span className="break-all font-mono text-zinc-300">{org.id}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client login (recommended)</CardTitle>
          <CardDescription>
            Create email + password for the business. They sign in at{" "}
            <Link href="/login" className="text-emerald-400 hover:underline">
              /login
            </Link>
            — no public registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProvisionClientForm organizationId={org.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Link existing login</CardTitle>
          <CardDescription>
            If the user already has an account, attach them to this business by
            email only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AddMemberForm organizationId={org.id} />
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {members.length === 0 ? (
              <li className="p-4 text-sm text-zinc-500">No members yet.</li>
            ) : (
              members.map((m) => (
                <li
                  key={m.email}
                  className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">{m.name}</p>
                    <p className="truncate text-zinc-500">{m.email}</p>
                  </div>
                  <span className="shrink-0 self-start rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-300 sm:self-center">
                    {m.role}
                  </span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      <Button variant="outline" asChild className="w-full sm:w-auto">
        <Link href={`/app/${org.slug}`}>Preview client dashboard</Link>
      </Button>
    </div>
  );
}
