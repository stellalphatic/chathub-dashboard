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
  const isAdmin = Boolean(me?.platformAdmin);

  // Admins can jump into ANY business; members only see the ones they belong to.
  const orgs = isAdmin
    ? await db
        .select({ slug: organization.slug, name: organization.name })
        .from(organization)
        .orderBy(asc(organization.name))
    : await db
        .select({ slug: organization.slug, name: organization.name })
        .from(organizationMember)
        .innerJoin(organization, eq(organizationMember.organizationId, organization.id))
        .where(eq(organizationMember.userId, session.user.id))
        .orderBy(asc(organization.name));

  return (
    <div
      className="min-h-screen bg-[rgb(var(--bg-muted))]"
      // Fallback for first paint before the client-side sidebar hydrates.
      style={{ ["--sidebar-w" as string]: "4.75rem" }}
    >
      <AppSidebar
        orgs={orgs}
        currentSlug={orgs[0]?.slug ?? ""}
        userEmail={session.user.email}
        platformAdmin={isAdmin}
      />
      <div className="md:pl-[var(--sidebar-w)] transition-[padding-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <AppTopbar />
        <main className="min-h-[calc(100dvh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
