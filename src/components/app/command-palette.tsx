"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Boxes,
  Command as CommandIcon,
  FileText,
  Home,
  Inbox,
  Megaphone,
  Plug,
  Search,
  Settings2,
  Sparkles,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  section: "Pages" | "Actions" | "Quick links";
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onRun?: () => void;
  keywords?: string;
  adminOnly?: boolean;
};

function buildActions(slug: string): PaletteAction[] {
  if (!slug) return [];
  const baseApp = `/app/${slug}`;
  return [
    // Pages
    { id: "p-overview", label: "Overview", section: "Pages", icon: Home, href: baseApp, keywords: "dashboard home stats" },
    { id: "p-inbox", label: "Inbox", section: "Pages", icon: Inbox, href: `${baseApp}/inbox`, keywords: "messages conversations chat whatsapp" },
    { id: "p-crm", label: "Customers", section: "Pages", icon: Users, href: `${baseApp}/crm`, keywords: "people contacts leads crm" },
    { id: "p-broadcasts", label: "Broadcasts", section: "Pages", icon: Megaphone, href: `${baseApp}/broadcasts`, keywords: "marketing campaigns bulk send", adminOnly: true },
    { id: "p-templates", label: "Templates", section: "Pages", icon: FileText, href: `${baseApp}/templates`, keywords: "whatsapp business templates hsm", adminOnly: true },
    { id: "p-bot", label: "Bot configuration", section: "Pages", icon: Bot, href: `${baseApp}/bot`, keywords: "system prompt ai persona", adminOnly: true },
    { id: "p-knowledge", label: "Knowledge", section: "Pages", icon: Boxes, href: `${baseApp}/knowledge`, keywords: "rag documents pdf upload", adminOnly: true },
    { id: "p-channels", label: "Channels & integrations", section: "Pages", icon: Plug, href: `${baseApp}/channels`, keywords: "whatsapp ycloud manychat instagram messenger integrations", adminOnly: true },
    { id: "p-team", label: "Team", section: "Pages", icon: UserCog, href: `${baseApp}/team`, keywords: "members users invite" },

    // Actions
    { id: "a-new-broadcast", label: "Create a broadcast", section: "Actions", icon: Megaphone, href: `${baseApp}/broadcasts?new=1`, keywords: "campaign send message", adminOnly: true },
    { id: "a-upload-doc", label: "Upload knowledge document", section: "Actions", icon: Sparkles, href: `${baseApp}/knowledge?upload=1`, keywords: "rag pdf docx", adminOnly: true },
    { id: "a-new-template", label: "Add a WhatsApp template", section: "Actions", icon: FileText, href: `${baseApp}/templates?new=1`, keywords: "hsm approval", adminOnly: true },
    { id: "a-invite-team", label: "Invite a teammate", section: "Actions", icon: UserCog, href: `${baseApp}/team?invite=1`, keywords: "member add email" },
    { id: "a-settings", label: "Open bot settings", section: "Actions", icon: Settings2, href: `${baseApp}/bot`, keywords: "persona tone behavior", adminOnly: true },

    // Quick links
    { id: "q-open-crm-search", label: "Search customers…", section: "Quick links", icon: Search, href: `${baseApp}/crm`, keywords: "find contact" },
  ];
}

export function CommandPalette({
  orgSlug,
  platformAdmin,
  open,
  onOpenChange,
}: {
  orgSlug: string;
  platformAdmin: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const actions = useMemo(
    () => buildActions(orgSlug).filter((a) => !a.adminOnly || platformAdmin),
    [orgSlug, platformAdmin],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) =>
      `${a.label} ${a.section} ${a.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [actions, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteAction[]>();
    for (const a of filtered) {
      const arr = map.get(a.section) ?? [];
      arr.push(a);
      map.set(a.section, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const run = useCallback(
    (action: PaletteAction) => {
      onOpenChange(false);
      if (action.onRun) action.onRun();
      else if (action.href) router.push(action.href);
    },
    [onOpenChange, router],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const a = filtered[activeIdx];
        if (a) run(a);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIdx, onOpenChange, run]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl shadow-black/30"
          >
            <div className="flex items-center gap-3 border-b border-[rgb(var(--border))] px-4">
              <Search className="h-4 w-4 shrink-0 text-[rgb(var(--fg-subtle))]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, actions, templates…"
                className="h-12 w-full bg-transparent text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--fg-subtle))] focus:outline-none"
              />
              <kbd className="hidden items-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[10px] font-mono text-[rgb(var(--fg-muted))] sm:inline-flex">
                ESC
              </kbd>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))] sm:hidden"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
              {grouped.length === 0 ? (
                <div className="py-10 text-center text-sm text-[rgb(var(--fg-subtle))]">
                  No matches. Try a different term.
                </div>
              ) : (
                grouped.map(([section, items]) => (
                  <div key={section} className="mb-1">
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                      {section}
                    </p>
                    <ul>
                      {items.map((a) => {
                        const idx = filtered.findIndex((x) => x.id === a.id);
                        const active = idx === activeIdx;
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIdx(idx)}
                              onClick={() => run(a)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                                active
                                  ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--fg))]"
                                  : "text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                                  active
                                    ? "bg-[rgb(var(--accent))] text-white"
                                    : "bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-muted))]",
                                )}
                              >
                                <a.icon className="h-3.5 w-3.5" />
                              </span>
                              <span className="flex-1 truncate">{a.label}</span>
                              {a.hint && (
                                <span className="text-xs text-[rgb(var(--fg-subtle))]">
                                  {a.hint}
                                </span>
                              )}
                              <ArrowRight
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 transition-opacity",
                                  active ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-[11px] text-[rgb(var(--fg-subtle))]">
              <div className="flex items-center gap-2">
                <CommandIcon className="h-3 w-3" />
                <span>Quick actions across your workspace</span>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <KbdHint label="↑↓" caption="navigate" />
                <KbdHint label="↵" caption="open" />
                <KbdHint label="ESC" caption="close" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KbdHint({ label, caption }: { label: string; caption: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="inline-flex h-4 items-center rounded border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-1 font-mono text-[10px]">
        {label}
      </kbd>
      <span>{caption}</span>
    </span>
  );
}
