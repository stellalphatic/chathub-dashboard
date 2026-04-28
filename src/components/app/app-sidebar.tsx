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
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Users,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand/brand-logo";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
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

const COLLAPSED_W = "5rem"; // 80px — roomy for a 44px logo + padding
const EXPANDED_W = "17rem";
const PIN_STORAGE_KEY = "chathub.sidebar.pinned";

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

  const [pinned, setPinned] = useState<boolean>(false);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      if (raw !== null) setPinned(raw === "1");
    } catch {
      // ignore
    }
  }, []);

  const expanded = pinned || hovered;

  // Publish sidebar width on <html> so the main layout's
  // `md:pl-[var(--sidebar-w)]` follows the current state.
  const setSidebarWidthVar = useCallback((w: string) => {
    document.documentElement.style.setProperty("--sidebar-w", w);
  }, []);

  useEffect(() => {
    setSidebarWidthVar(expanded ? EXPANDED_W : COLLAPSED_W);
  }, [expanded, setSidebarWidthVar]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const urlMatch = pathname?.match(/^\/app\/([^/]+)/);
  const activeSlug = urlMatch?.[1] ?? currentSlug;

  const sections = useMemo(
    () =>
      buildSections(activeSlug).map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.adminOnly || platformAdmin),
      })),
    [activeSlug, platformAdmin],
  );

  const orgOptions: SelectOption[] = orgs.map((o) => ({
    value: o.slug,
    label: o.name,
  }));

  function togglePin() {
    setPinned((v) => {
      const next = !v;
      try {
        localStorage.setItem(PIN_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <>
      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--bg)/0.8)] px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href="/app" className="flex items-center gap-2 font-semibold">
          <BrandMark size={32} />
          <span className="text-[rgb(var(--fg))]">
            Chat<span className="gradient-text">Hub</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg border border-[rgb(var(--border))] p-2"
          aria-label="Toggle menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          // @ts-expect-error CSS custom property
          "--sb-w": expanded ? EXPANDED_W : COLLAPSED_W,
        }}
        className={cn(
          "group/sidebar fixed inset-y-0 left-0 z-50 flex h-dvh flex-col",
          "w-72 max-w-[85vw] md:w-[var(--sb-w)]",
          "overflow-x-hidden", // ← critical: hides overflowing labels while collapsing
          "border-r border-[rgb(var(--border))]",
          "bg-gradient-to-b from-[rgb(var(--surface))] via-[rgb(var(--surface))] to-[rgb(var(--surface-2))]",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Accent vertical ribbon */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[rgb(var(--brand-from))] via-[rgb(var(--brand-via))] to-[rgb(var(--brand-to))] opacity-60"
        />

        {/* Logo row — icon stays centered in the collapsed column.
            Pin button is rendered as an absolutely-positioned overlay so it
            doesn't take row space — that's why icons don't shift when it
            appears/disappears. Only visible when expanded. */}
        <div className="relative flex h-[72px] shrink-0 items-center px-3">
          <Link
            href="/app"
            className="group relative flex h-12 w-full items-center gap-3 rounded-xl px-2 font-semibold hover:bg-[rgb(var(--surface-2))]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center">
              <BrandMark size={44} />
            </span>
            <CollapsibleLabel expanded={expanded}>
              <span className="text-[17px] text-[rgb(var(--fg))]">
                Chat<span className="gradient-text">Hub</span>
              </span>
            </CollapsibleLabel>
          </Link>

          {expanded && (
            <button
              type="button"
              onClick={togglePin}
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md p-1.5 text-[rgb(var(--fg-muted))] transition-colors hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] md:inline-flex"
              aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            >
              {pinned ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        <div className="mx-3 border-b border-[rgb(var(--border))]" />

        {/* Business switcher — fixed height in BOTH states so nav icons
            below never shift vertically when the sidebar expands. */}
        {orgs.length > 0 && (
          <div className="flex h-[88px] shrink-0 flex-col px-3 pt-3">
            {expanded ? (
              <>
                <p className="mb-1 pl-1 text-[10.5px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                  Business
                </p>
                <SearchableSelect
                  value={activeSlug}
                  options={orgOptions}
                  onChange={(slug) => router.push(`/app/${slug}`)}
                  searchPlaceholder="Search business…"
                  placeholder="Select a business"
                />
              </>
            ) : (
              <div
                className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-xs font-semibold text-[rgb(var(--accent))]"
                title={orgs.find((o) => o.slug === activeSlug)?.name}
              >
                {(orgs.find((o) => o.slug === activeSlug)?.name ?? "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
          </div>
        )}

        {!platformAdmin && expanded ? (
          <div className="px-3 pb-3">
            <div className="flex items-start gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-2 text-[11px] text-[rgb(var(--fg-muted))]">
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-[rgb(var(--fg-subtle))]" />
              <span>
                Bot, channels, knowledge and templates are managed by your ChatHub administrator.
              </span>
            </div>
          </div>
        ) : null}

        <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
          {sections.map((section) => {
            if (section.items.length === 0) return null;
            return (
              <div key={section.label} className="mb-4">
                {/* Section label always rendered with fixed height so the
                    nav items below never shift vertically when collapsing.
                    Just fades in/out instead of toggling layout. */}
                <p
                  className={cn(
                    "h-5 whitespace-nowrap px-3 text-[10.5px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))] transition-opacity duration-200",
                    expanded ? "opacity-100" : "opacity-0",
                  )}
                >
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active =
                      item.match === "exact"
                        ? pathname === item.href
                        : pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                            active
                              ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))] font-medium"
                              : "text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]",
                          )}
                          title={!expanded ? item.label : undefined}
                        >
                          {active && (
                            <span
                              aria-hidden
                              className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-[rgb(var(--accent))]"
                            />
                          )}
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                          <CollapsibleLabel expanded={expanded}>
                            {item.label}
                          </CollapsibleLabel>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[rgb(var(--border))] p-3">
          {platformAdmin && (
            <Link
              href="/admin"
              className={cn(
                "mb-2 flex h-10 items-center gap-3 rounded-lg px-3 text-sm",
                "border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))]",
                "transition-colors hover:border-[rgb(var(--accent)/0.5)]",
              )}
              title={!expanded ? "Staff console" : undefined}
            >
              <BarChart3 className="h-[18px] w-[18px] shrink-0 text-[rgb(var(--accent))]" />
              <CollapsibleLabel expanded={expanded}>
                Staff console
              </CollapsibleLabel>
            </Link>
          )}
          {expanded && (
            <p className="mt-1 whitespace-nowrap px-3 text-[11px] text-[rgb(var(--fg-subtle))]">
              <span className="block truncate">{userEmail}</span>
            </p>
          )}
        </div>

      </aside>
    </>
  );
}

/**
 * Label that animates between hidden (max-width: 0) and fully-visible using a
 * max-width transition. Because max-width hits zero, it never overflows the
 * collapsed sidebar, and the icon next to it stays perfectly anchored.
 */
function CollapsibleLabel({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden={!expanded}
      className={cn(
        "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        expanded
          ? "max-w-[12rem] opacity-100"
          : "pointer-events-none max-w-0 opacity-0",
      )}
    >
      {children}
    </span>
  );
}
