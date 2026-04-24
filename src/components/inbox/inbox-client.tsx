"use client";

import {
  Bot,
  CheckCircle2,
  Clock3,
  Facebook,
  Hand,
  Instagram,
  MessageCircle,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { markConversationReadAction } from "@/lib/org-actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type ConversationListItem = {
  id: string;
  channel: string;
  mode: string;
  status: string;
  unreadCount: number;
  lastInboundAt: Date | null;
  lastMessageAt: Date | null;
  preview: string | null;
  displayName: string | null;
  phoneE164: string | null;
};

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  messenger: Facebook,
};

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: "text-emerald-500",
  instagram: "text-pink-500",
  messenger: "text-blue-500",
};

type ModeFilter = "all" | "bot" | "human";
type StatusFilter = "all" | "open" | "snoozed" | "closed";
type UnreadFilter = "all" | "unread";

export function InboxSidebar({
  orgSlug,
  conversations,
  selectedId,
}: {
  orgSlug: string;
  conversations: ConversationListItem[];
  selectedId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [channel, setChannel] = useState<string>(params.get("channel") ?? "all");
  const [mode, setMode] = useState<ModeFilter>(
    (params.get("mode") as ModeFilter) ?? "all",
  );
  const [status, setStatus] = useState<StatusFilter>(
    (params.get("status") as StatusFilter) ?? "open",
  );
  const [unread, setUnread] = useState<UnreadFilter>(
    (params.get("unread") as UnreadFilter) ?? "all",
  );

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (channel !== "all" && c.channel !== channel) return false;
      if (mode !== "all" && c.mode !== mode) return false;
      if (status !== "all" && c.status !== status) return false;
      if (unread === "unread" && (c.unreadCount ?? 0) <= 0) return false;
      if (qLower) {
        const haystack = [
          c.displayName ?? "",
          c.phoneE164 ?? "",
          c.preview ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(qLower)) return false;
      }
      return true;
    });
  }, [conversations, q, channel, mode, status, unread]);

  // Mark conversation read when selected
  useEffect(() => {
    if (!selectedId) return;
    markConversationReadAction({ orgSlug, conversationId: selectedId }).catch(() => {});
  }, [selectedId, orgSlug]);

  const clearFilters = () => {
    setQ("");
    setChannel("all");
    setMode("all");
    setStatus("open");
    setUnread("all");
    router.replace(pathname);
  };

  const openConv = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("c", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const anyFilter =
    q !== "" ||
    channel !== "all" ||
    mode !== "all" ||
    status !== "open" ||
    unread !== "all";

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      {/* Header */}
      <div className="border-b border-[rgb(var(--border))] px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
            Chats ({filtered.length}/{conversations.length})
          </p>
          {anyFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] font-medium text-[rgb(var(--accent))] hover:underline"
            >
              Reset
            </button>
          ) : null}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, or text…"
            className="pl-9 pr-8"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[rgb(var(--fg-subtle))] hover:bg-[rgb(var(--surface-2))]"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {(["all", "whatsapp", "instagram", "messenger"] as const).map((c) => (
            <FilterChip
              key={`ch-${c}`}
              active={channel === c}
              onClick={() => setChannel(c)}
              icon={c !== "all" ? CHANNEL_ICON[c] : undefined}
              label={c === "all" ? "All channels" : c}
            />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
          <FilterChip
            active={unread === "unread"}
            onClick={() => setUnread(unread === "unread" ? "all" : "unread")}
            label="Unread"
            tint="warn"
          />
          <FilterChip
            active={mode === "bot"}
            onClick={() => setMode(mode === "bot" ? "all" : "bot")}
            icon={Bot}
            label="AI on"
          />
          <FilterChip
            active={mode === "human"}
            onClick={() => setMode(mode === "human" ? "all" : "human")}
            icon={Hand}
            label="AI off"
          />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
          <FilterChip
            active={status === "open"}
            onClick={() => setStatus("open")}
            label="Open"
          />
          <FilterChip
            active={status === "snoozed"}
            onClick={() => setStatus("snoozed")}
            label="Snoozed"
          />
          <FilterChip
            active={status === "closed"}
            onClick={() => setStatus("closed")}
            label="Closed"
          />
          <FilterChip
            active={status === "all"}
            onClick={() => setStatus("all")}
            label="All statuses"
          />
        </div>
      </div>

      {/* List */}
      <ul className="scrollbar-thin flex-1 min-h-0 divide-y divide-[rgb(var(--border))] overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
            {conversations.length === 0 ? (
              <>
                No conversations yet. Connect a channel under{" "}
                <Link
                  href={`/app/${orgSlug}/channels`}
                  className="text-[rgb(var(--accent))] hover:underline"
                >
                  Channels
                </Link>
                .
              </>
            ) : (
              "No matches for your filters."
            )}
          </li>
        ) : (
          filtered.map((cv) => {
            const isActive = cv.id === selectedId;
            const Icon = CHANNEL_ICON[cv.channel] ?? MessageCircle;
            const colorCls = CHANNEL_COLOR[cv.channel] ?? "text-[rgb(var(--accent))]";
            return (
              <li key={cv.id}>
                <button
                  type="button"
                  onClick={() => openConv(cv.id)}
                  className={cn(
                    "group block w-full px-3 py-2.5 text-left transition-colors",
                    isActive
                      ? "bg-[rgb(var(--accent)/0.1)]"
                      : "hover:bg-[rgb(var(--surface-2))]",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-2))]",
                        colorCls,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[rgb(var(--fg))]">
                          {cv.displayName ||
                            (cv.phoneE164?.startsWith("ext:")
                              ? "Customer"
                              : cv.phoneE164) ||
                            "Unknown"}
                        </p>
                        <span className="shrink-0 text-[10px] text-[rgb(var(--fg-subtle))]">
                          {cv.lastMessageAt ? timeAgo(cv.lastMessageAt) : ""}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[rgb(var(--fg-muted))]">
                        {cv.preview ?? "No messages yet"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge
                          variant={cv.mode === "bot" ? "success" : "warning"}
                          className="text-[9px] px-1.5 py-0"
                        >
                          {cv.mode === "bot" ? "AI" : "Human"}
                        </Badge>
                        {cv.status !== "open" ? (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {cv.status}
                          </Badge>
                        ) : null}
                        {(cv.unreadCount ?? 0) > 0 ? (
                          <Badge variant="gradient" className="text-[9px] px-1.5 py-0">
                            {cv.unreadCount} new
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon: Icon,
  tint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  tint?: "warn";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors",
        active
          ? tint === "warn"
            ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]"
          : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg-muted))] hover:border-[rgb(var(--accent)/0.4)]",
      )}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {label}
    </button>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

/** Subtle "live" indicator for the inbox header. */
export function LiveIndicator() {
  const router = useRouter();
  const lastTick = useRef(Date.now());
  const [dot, setDot] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      lastTick.current = Date.now();
      setDot((v) => !v);
    }, 5000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-[rgb(var(--fg-subtle))]">
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full bg-emerald-400",
            dot ? "opacity-60 animate-ping" : "opacity-0",
          )}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live · syncs every 5s
    </div>
  );
}

/** Empty state for the right-hand panel when nothing is selected. */
export function InboxEmptyPane({ convCount }: { convCount: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-muted))]">
        <MessageCircle className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">
        {convCount === 0 ? "No conversations yet" : "Select a conversation"}
      </p>
      <p className="text-xs text-[rgb(var(--fg-subtle))]">
        {convCount === 0
          ? "Once a customer messages you, threads appear here."
          : "Pick a thread from the left."}
      </p>
      {convCount === 0 ? (
        <CheckCircle2 className="mt-3 h-3 w-3 text-emerald-500 opacity-0" />
      ) : null}
      <Clock3 className="mt-2 h-0 w-0" />
    </div>
  );
}
