import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, organizationMember } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const { orgSlug } = await params;

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);
  if (!org) notFound();

  const [member] = await db
    .select({ id: organizationMember.id })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, org.id),
        eq(organizationMember.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member) {
    redirect("/app");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <p className="text-sm text-zinc-500 font-mono">{org.slug}</p>
        </div>
        <nav className="flex w-full gap-2 rounded-xl border border-white/10 bg-white/5 p-1 sm:w-auto">
          <Link
            href={`/app/${orgSlug}`}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4 touch-manipulation",
              "text-zinc-300 hover:bg-white/5 hover:text-white",
            )}
          >
            Dashboard
          </Link>
          <Link
            href={`/app/${orgSlug}/inbox`}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4 touch-manipulation",
              "text-zinc-300 hover:bg-white/5 hover:text-white",
            )}
          >
            Inbox
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
