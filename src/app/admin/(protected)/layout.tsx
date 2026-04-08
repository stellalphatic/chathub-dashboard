import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/admin/login?next=/admin");
  }

  const [row] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!row?.platformAdmin) {
    redirect("/login?notice=not_staff");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <Link href="/admin" className="shrink-0 font-semibold tracking-tight">
              ChatHub <span className="text-emerald-400">Staff</span>
            </Link>
            <nav className="hidden min-w-0 sm:flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <Link href="/admin" className="hover:text-white transition-colors">
                Businesses
              </Link>
              <Link
                href="/admin/organizations/new"
                className="hover:text-white transition-colors"
              >
                New business
              </Link>
            </nav>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <span className="truncate text-xs text-zinc-500 sm:text-sm sm:max-w-[10rem]">
              {session.user.email}
            </span>
            <div className="flex items-center gap-2">
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
