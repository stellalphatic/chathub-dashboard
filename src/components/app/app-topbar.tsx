"use client";

import { UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import {
  Bell,
  ChevronRight,
  Inbox,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CommandPalette } from "@/components/app/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
  "": "Overview",
  inbox: "Inbox",
  crm: "Customers",
  broadcasts: "Broadcasts",
  templates: "Templates",
  bot: "Bot",
  knowledge: "Knowledge",
  channels: "Channels",
  team: "Team",
};

export function AppTopbar({ platformAdmin }: { platformAdmin?: boolean } = {}) {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad/i.test(navigator.platform),
    );
  }, []);

  const { orgSlug, section } = useMemo(() => {
    const m = pathname?.match(/^\/app\/([^/]+)(?:\/([^/]+))?/);
    return { orgSlug: m?.[1] ?? "", section: m?.[2] ?? "" };
  }, [pathname]);

  const sectionLabel = SECTION_LABELS[section] ?? "Workspace";

  // Keyboard shortcut: ⌘K / Ctrl+K to open the palette, `/` to focus search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (cmdK) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      // "/" to open search — ignore when typing inside inputs
      if (e.key === "/") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && !target?.isContentEditable) {
          e.preventDefault();
          setPaletteOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg)/0.75)] px-4 backdrop-blur-xl sm:gap-3 sm:px-6">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 shrink-0 items-center gap-1.5 text-sm md:flex"
        >
          <Link
            href={orgSlug ? `/app/${orgSlug}` : "/app"}
            className="truncate font-medium text-[rgb(var(--fg))] transition-colors hover:text-[rgb(var(--accent))]"
          >
            {orgSlug || "Workspaces"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--fg-subtle))]" />
          <span className="truncate text-[rgb(var(--fg-muted))]">{sectionLabel}</span>
        </nav>

        {/* Search / command trigger */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "group mx-auto flex h-10 w-full max-w-lg items-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 text-sm transition-all",
            "hover:border-[rgb(var(--accent)/0.5)] hover:shadow-[0_0_0_3px_rgb(var(--accent)/0.08)]",
          )}
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4 shrink-0 text-[rgb(var(--fg-subtle))] transition-colors group-hover:text-[rgb(var(--accent))]" />
          <span className="flex-1 truncate text-left text-[rgb(var(--fg-subtle))]">
            Search pages, customers, templates…
          </span>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <kbd className="inline-flex h-5 items-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-1.5 font-mono text-[10px] text-[rgb(var(--fg-muted))]">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <kbd className="inline-flex h-5 items-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-1.5 font-mono text-[10px] text-[rgb(var(--fg-muted))]">
              K
            </kbd>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* AI status pill — playful heartbeat */}
          <div
            className="hidden items-center gap-1.5 rounded-full border border-[rgb(var(--accent)/0.25)] bg-[rgb(var(--accent)/0.08)] px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--accent))] lg:inline-flex"
            title="AI replies are active"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgb(var(--accent))] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />
            </span>
            AI live
          </div>

          {/* Quick inbox button */}
          {orgSlug && (
            <Link
              href={`/app/${orgSlug}/inbox`}
              className="relative hidden h-9 w-9 items-center justify-center rounded-lg text-[rgb(var(--fg-muted))] transition-colors hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] sm:inline-flex"
              aria-label="Open inbox"
              title="Open inbox"
            >
              <Inbox className="h-4 w-4" />
            </Link>
          )}

          {/* New broadcast quick action — admin only */}
          {platformAdmin && orgSlug && (
            <Link
              href={`/app/${orgSlug}/broadcasts?new=1`}
              className="hidden h-9 items-center gap-1 rounded-lg bg-gradient-to-r from-[rgb(var(--brand-from))] to-[rgb(var(--brand-to))] px-3 text-xs font-medium text-white shadow-sm transition-shadow hover:shadow-md md:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" />
              New broadcast
            </Link>
          )}

          {/* Notifications — stubbed for now; hooks up when you ship alerts */}
          <NotificationsButton />

          <ThemeToggle />

          <UserButton
            appearance={
              resolvedTheme === "dark" ? { baseTheme: dark } : undefined
            }
            userProfileProps={{
              appearance:
                resolvedTheme === "dark" ? { baseTheme: dark } : undefined,
            }}
          />
        </div>
      </header>

      <CommandPalette
        orgSlug={orgSlug}
        platformAdmin={Boolean(platformAdmin)}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </>
  );
}

function NotificationsButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[rgb(var(--fg-muted))] transition-colors hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="animate-scale-in absolute right-0 top-[calc(100%+6px)] z-40 w-80 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-3 py-2.5">
              <p className="text-sm font-semibold">Notifications</p>
              <Badge variant="secondary" className="text-[10px]">
                Live
              </Badge>
            </div>
            <div className="scrollbar-thin max-h-80 overflow-y-auto p-2">
              <NotificationItem
                icon={Sparkles}
                title="You're all caught up"
                body="New conversations, LLM failures and approvals will surface here."
                tone="accent"
              />
            </div>
            <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-[11px] text-[rgb(var(--fg-subtle))]">
              We&apos;ll light this up as soon as there&apos;s something you should see.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationItem({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: "accent" | "warning" | "danger";
}) {
  const toneCls = {
    accent: "bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]",
    warning: "bg-amber-500/15 text-amber-500",
    danger: "bg-rose-500/15 text-rose-500",
  }[tone];
  return (
    <div className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-[rgb(var(--surface-2))]">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          toneCls,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[rgb(var(--fg))]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--fg-muted))]">
          {body}
        </p>
      </div>
    </div>
  );
}
