import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { db } from "@/db";
import { organization, organizationMember, user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/sign-in?redirect_url=%2Fapp");
  }

  const [me] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  const orgs = await db
    .select({
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

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-muted))]">
      <AppSidebar
        orgs={orgs}
        currentSlug={orgs[0]?.slug ?? ""}
        userEmail={session.user.email}
        platformAdmin={Boolean(me?.platformAdmin)}
      />
      <div className="md:pl-64">
        <AppTopbar />
        <main className="min-h-[calc(100dvh-4rem)] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
