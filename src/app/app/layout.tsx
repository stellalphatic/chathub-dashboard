import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { AppOrgNav } from "@/components/app-org-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { db } from "@/db";
import { organization, organizationMember } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?next=/app");
  }

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
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href="/app"
              className="shrink-0 text-base font-semibold tracking-tight sm:text-lg"
            >
              ChatHub
            </Link>
            <AppOrgNav orgs={orgs} />
            <nav className="hidden min-w-0 flex-wrap items-center gap-2 text-sm sm:flex">
              {orgs.map((o) => (
                <Link
                  key={o.slug}
                  href={`/app/${o.slug}`}
                  className="rounded-lg px-2 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {o.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3 sm:border-0 sm:pt-0">
            <span className="min-w-0 truncate text-xs text-zinc-500 sm:max-w-[12rem] sm:text-sm">
              {session.user.email}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/"
                className="text-xs text-zinc-500 hover:text-zinc-300 sm:text-sm"
              >
                Home
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</div>
    </div>
  );
}
