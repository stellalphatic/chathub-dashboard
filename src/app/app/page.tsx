import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, organizationMember, user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AppHomePage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

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

  if (orgs.length === 1) {
    redirect(`/app/${orgs[0].slug}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your workspaces</h1>
        <p className="mt-1 text-zinc-400">
          Pick a business dashboard. Inbox and analytics are scoped per
          organization.
        </p>
      </div>

      {me?.platformAdmin ? (
        <p className="text-sm text-zinc-500">
          You are a platform admin — manage businesses in{" "}
          <Link href="/admin" className="text-emerald-400 hover:underline">
            Admin
          </Link>
          .
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {orgs.length === 0 ? (
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle>No organizations yet</CardTitle>
              <CardDescription>
                Ask your ChatHub administrator to add your account to a business.
              </CardDescription>
            </CardHeader>
            {me?.platformAdmin ? (
              <CardContent>
                <Button asChild>
                  <Link href="/admin/organizations/new">Create a business</Link>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        ) : (
          orgs.map((o) => (
            <Card
              key={o.id}
              className="hover:border-emerald-500/30 transition-colors"
            >
              <CardHeader>
                <CardTitle>{o.name}</CardTitle>
                <CardDescription className="font-mono text-emerald-400/90">
                  {o.slug}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/app/${o.slug}`}>Dashboard</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/app/${o.slug}/inbox`}>WhatsApp inbox</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
