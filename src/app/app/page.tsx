import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, Briefcase, Plus } from "lucide-react";
import { db } from "@/db";
import { organization, organizationMember, user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AppHomePage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/sign-in?redirect_url=%2Fapp");

  const [me] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  const orgs = await db
    .select({
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
    })
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organizationMember.organizationId, organization.id),
    )
    .where(eq(organizationMember.userId, session.user.id))
    .orderBy(asc(organization.name));

  if (orgs.length === 1 && !me?.platformAdmin) {
    redirect(`/app/${orgs[0].slug}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--fg))]">
            Your workspaces
          </h1>
          {me?.platformAdmin ? <Badge variant="gradient">Platform admin</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          Pick a business to manage. Inbox, CRM, bots and analytics are scoped per organization.
        </p>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No organizations yet</CardTitle>
            <CardDescription>
              {me?.platformAdmin
                ? "Create a business to get started."
                : "Ask your ChatHub administrator to add your account to a business."}
            </CardDescription>
          </CardHeader>
          {me?.platformAdmin ? (
            <CardContent>
              <Button asChild variant="gradient">
                <Link href="/admin/organizations/new">
                  <Plus className="h-4 w-4" /> Create a business
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => (
            <Link key={o.id} href={`/app/${o.slug}`} className="fade-up-item">
              <Card interactive className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                      <Briefcase className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-[rgb(var(--fg-subtle))] transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold tracking-tight">{o.name}</p>
                    <p className="mt-1 font-mono text-xs text-[rgb(var(--fg-subtle))]">
                      {o.slug}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {me?.platformAdmin ? (
            <Link href="/admin/organizations/new" className="fade-up-item">
              <Card
                interactive
                className="h-full border-dashed text-center"
              >
                <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-muted))]">
                    <Plus className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-[rgb(var(--fg))]">
                    New business
                  </p>
                  <p className="text-xs text-[rgb(var(--fg-subtle))]">
                    Create from the staff console
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
