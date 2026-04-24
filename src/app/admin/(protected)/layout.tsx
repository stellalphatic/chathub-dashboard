import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { BarChart3, Building2, Cpu, Plus, Users } from "lucide-react";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import { AdminUserButton } from "./_user-button";
import { BrandMark } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/admin", label: "Businesses", icon: Building2, match: "exact" as const },
  { href: "/admin/organizations/new", label: "New business", icon: Plus },
  { href: "/admin/llm", label: "LLM providers", icon: Cpu },
  { href: "/admin/usage", label: "Usage", icon: BarChart3 },
  { href: "/admin/staff", label: "Staff", icon: Users },
];

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/sign-in?redirect_url=%2Fadmin");
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
    <div className="min-h-screen bg-[rgb(var(--bg-muted))]">
      <header className="sticky top-0 z-40 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg)/0.8)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <Link
            href="/admin"
            className="group flex shrink-0 items-center gap-2 font-semibold"
          >
            <BrandMark size={32} />
            <span className="text-[rgb(var(--fg))]">
              Chat<span className="gradient-text">Hub</span>
            </span>
            <Badge variant="gradient" className="ml-1 hidden sm:inline-flex text-[10px]">
              Staff
            </Badge>
          </Link>

          <nav className="hidden min-w-0 flex-wrap items-center gap-1 text-sm md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[rgb(var(--fg-muted))] transition-colors hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]"
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/app"
              className="hidden rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-xs text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] sm:inline-block"
            >
              Workspaces
            </Link>
            <AdminUserButton />
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-[rgb(var(--border))] px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))]"
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </Link>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
