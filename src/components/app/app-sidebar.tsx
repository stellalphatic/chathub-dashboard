"use client";

import {
  Bot,
  Boxes,
  BarChart3,
  FileText,
  Home,
  Inbox,
  Lock,
  Megaphone,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Users,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Org = { slug: string; name: string };

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  match?: "exact";
  /** Only platform admins see this item. */
  adminOnly?: boolean;
};

function buildSections(slug: string): { label: string; items: NavItem[] }[] {
  return [
    {
      label: "Workspace",
      items: [
        { href: `/app/${slug}`, icon: Home, label: "Overview", match: "exact" },
        { href: `/app/${slug}/inbox`, icon: Inbox, label: "Inbox" },
        { href: `/app/${slug}/crm`, icon: Users, label: "Customers" },
      ],
    },
    {
      label: "Messaging",
      items: [
        { href: `/app/${slug}/broadcasts`, icon: Megaphone, label: "Broadcasts", adminOnly: true },
        { href: `/app/${slug}/templates`, icon: FileText, label: "Templates", adminOnly: true },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { href: `/app/${slug}/bot`, icon: Bot, label: "Bot", adminOnly: true },
        { href: `/app/${slug}/knowledge`, icon: Boxes, label: "Knowledge", adminOnly: true },
      ],
    },
    {
      label: "Integrations",
      items: [
        { href: `/app/${slug}/channels`, icon: Plug, label: "Channels", adminOnly: true },
      ],
    },
    {
      label: "Org",
      items: [{ href: `/app/${slug}/team`, icon: UserCog, label: "Team" }],
    },
  ];
}

export function AppSidebar({
  orgs,
  currentSlug,
  userEmail,
  platformAdmin,
}: {
  orgs: Org[];
  currentSlug: string;
  userEmail: string;
  platformAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Pick the slug from the current URL so the sidebar always shows the right context.
  const urlMatch = pathname?.match(/^\/app\/([^/]+)/);
  const activeSlug = urlMatch?.[1] ?? currentSlug;

  const sections = buildSections(activeSlug).map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || platformAdmin),
  }));

  const widthClass = collapsed ? "md:w-[4.5rem]" : "md:w-64";

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--bg)/0.8)] px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href="/app" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl gradient-brand text-white">
            <MessageSquareText className="h-4 w-4" />
          </span>
          ChatHub
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg border border-[rgb(var(--border))] p-2"
          aria-label="Toggle menu"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))] transition-all duration-200",
          "w-72 max-w-[85vw]",
          widthClass,
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[rgb(var(--border))] px-4">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white shadow-md">
              <MessageSquareText className="h-4 w-4" />
            </span>
            {!collapsed && <span>ChatHub</span>}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded-md p-1.5 text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] md:inline-flex"
            aria-label="Collapse sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {orgs.length > 0 && !collapsed && (
          <div className="border-b border-[rgb(var(--border))] p-3">
            <label
              htmlFor="org-switch"
              className="block text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]"
            >
              Business
            </label>
            <select
              id="org-switch"
              value={activeSlug}
              onChange={(e) => router.push(`/app/${e.target.value}`)}
              className="mt-1 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--fg))]"
            >
              {orgs.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!platformAdmin && !collapsed ? (
          <div className="border-b border-[rgb(var(--border))] p-3">
            <div className="flex items-start gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-2 text-[11px] text-[rgb(var(--fg-muted))]">
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-[rgb(var(--fg-subtle))]" />
              <span>
                Bot, channels, knowledge and templates are managed by your ChatHub administrator.
              </span>
            </div>
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {sections.map((section) => (
            <div key={section.label} className="mb-4">
              {!collapsed && section.items.length > 0 && (
                <p className="px-3 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    item.match === "exact"
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))] font-medium"
                            : "text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]",
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[rgb(var(--border))] p-3">
          {platformAdmin && (
            <Link
              href="/admin"
              className={cn(
                "mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                "border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]",
                "hover:border-[rgb(var(--accent)/0.5)]",
              )}
              title="Admin console"
            >
              <BarChart3 className="h-4 w-4 text-[rgb(var(--accent))]" />
              {!collapsed && <span>Staff console</span>}
            </Link>
          )}
          {!collapsed && (
            <p className="px-3 py-1 text-[11px] text-[rgb(var(--fg-subtle))]">
              <span className="block truncate">{userEmail}</span>
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
