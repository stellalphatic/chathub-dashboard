"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Calendar,
  CalendarCheck2,
  ChevronDown,
  LayoutGrid,
  LayoutList,
  MessageCircle,
  MoreVertical,
  Search,
  Tag,
  Trello,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { setCustomerStatusAction } from "@/lib/crm-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CrmRow = {
  id: string;
  displayName: string | null;
  phoneE164: string;
  email: string | null;
  tags: string[];
  status: string;
  lastContactedAt: string | null;
  meetingBooked: boolean;
  meetingTime: string | null;
  createdAt: string;
  messageCount: number;
};

type ViewMode = "list" | "grid" | "kanban" | "appointments";

const STATUSES = [
  { id: "new", label: "New", color: "bg-sky-500" },
  { id: "active", label: "Active", color: "bg-emerald-500" },
  { id: "follow_up", label: "Follow-up", color: "bg-amber-500" },
  { id: "converted", label: "Converted", color: "bg-violet-500" },
  { id: "dnd", label: "Do not disturb", color: "bg-rose-500" },
] as const;

type StatusId = (typeof STATUSES)[number]["id"];

function statusBadge(
  status: string,
): "success" | "warning" | "danger" | "secondary" | "gradient" {
  switch (status) {
    case "active":
      return "success";
    case "follow_up":
      return "warning";
    case "dnd":
      return "danger";
    case "converted":
      return "gradient";
    default:
      return "secondary";
  }
}

function formatShort(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function parseMeetingDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysAway(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "Past";
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export function CrmListClient({
  orgSlug,
  initialQuery,
  rows,
}: {
  orgSlug: string;
  initialQuery: string;
  rows: CrmRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>("list");
  const [q, setQ] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusId | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [onlyWithMeeting, setOnlyWithMeeting] = useState(false);
  const [pending, start] = useTransition();

  // Debounced server search (kept from original)
  const applySearch = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const t = value.trim();
      if (t) next.set("q", t);
      else next.delete("q");
      start(() => {
        router.push(`/app/${orgSlug}/crm?${next.toString()}`);
      });
    },
    [orgSlug, router, searchParams, start],
  );

  // Pre-compute unique tag list for chip filter
  const allTags = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => (r.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [rows]);

  // Client-side filtering on top of server search (keeps typing fast)
  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (tagFilter && !(r.tags ?? []).includes(tagFilter)) return false;
      if (onlyWithMeeting && !r.meetingBooked) return false;
      if (qLower) {
        const h = [
          r.displayName ?? "",
          r.phoneE164,
          r.email ?? "",
          (r.tags ?? []).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!h.includes(qLower)) return false;
      }
      return true;
    });
  }, [rows, q, statusFilter, tagFilter, onlyWithMeeting]);

  const withMeeting = useMemo(
    () => rows.filter((r) => r.meetingBooked).length,
    [rows],
  );

  const byStatus = useMemo(() => {
    const map: Record<string, CrmRow[]> = {};
    for (const s of STATUSES) map[s.id] = [];
    for (const r of filtered) {
      const key = STATUSES.find((s) => s.id === r.status)?.id ?? "new";
      map[key].push(r);
    }
    return map;
  }, [filtered]);

  const upcoming = useMemo(() => {
    return filtered
      .filter((r) => r.meetingBooked)
      .map((r) => ({ row: r, dt: parseMeetingDate(r.meetingTime) }))
      .sort((a, b) => {
        const at = a.dt?.getTime() ?? Infinity;
        const bt = b.dt?.getTime() ?? Infinity;
        return at - bt;
      });
  }, [filtered]);

  const resetFilters = () => {
    setQ("");
    setStatusFilter("all");
    setTagFilter(null);
    setOnlyWithMeeting(false);
    applySearch("");
  };

  const anyFilter =
    q !== "" || statusFilter !== "all" || tagFilter !== null || onlyWithMeeting;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="stagger grid gap-3 sm:grid-cols-4">
        {[
          { label: "Contacts", value: rows.length },
          { label: "Active", value: rows.filter((r) => r.status === "active").length },
          { label: "Follow-up", value: rows.filter((r) => r.status === "follow_up").length },
          { label: "With meeting", value: withMeeting },
        ].map((k) => (
          <Card key={k.label} className="fade-up-item">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                {k.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              applySearch(q);
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email, tag…"
              className="pl-10 pr-9"
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  applySearch("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[rgb(var(--fg-subtle))] hover:bg-[rgb(var(--surface-2))]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </form>

          <div className="inline-flex shrink-0 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-0.5">
            <ViewButton
              active={view === "list"}
              onClick={() => setView("list")}
              icon={LayoutList}
              label="List"
            />
            <ViewButton
              active={view === "grid"}
              onClick={() => setView("grid")}
              icon={LayoutGrid}
              label="Grid"
            />
            <ViewButton
              active={view === "kanban"}
              onClick={() => setView("kanban")}
              icon={Trello}
              label="Kanban"
            />
            <ViewButton
              active={view === "appointments"}
              onClick={() => setView("appointments")}
              icon={CalendarCheck2}
              label="Appts"
            />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <FilterChip
            active={statusFilter === "all"}
            label="All statuses"
            onClick={() => setStatusFilter("all")}
          />
          {STATUSES.map((s) => (
            <FilterChip
              key={s.id}
              active={statusFilter === s.id}
              onClick={() => setStatusFilter(s.id)}
              dot={s.color}
              label={s.label}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />
          <FilterChip
            active={onlyWithMeeting}
            onClick={() => setOnlyWithMeeting((v) => !v)}
            icon={Calendar}
            label="Meeting booked"
          />
          {allTags.length > 0 ? (
            <>
              <span className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />
              {allTags.slice(0, 12).map((t) => (
                <FilterChip
                  key={t}
                  active={tagFilter === t}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  icon={Tag}
                  label={t}
                />
              ))}
            </>
          ) : null}
          {anyFilter ? (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-1 text-[11px] font-medium text-[rgb(var(--accent))] hover:underline"
            >
              Reset
            </button>
          ) : null}
          {pending ? (
            <span className="ml-auto text-[10px] text-[rgb(var(--fg-subtle))]">
              searching…
            </span>
          ) : null}
        </div>
      </div>

      {/* Views */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <User className="mx-auto h-8 w-8 text-[rgb(var(--fg-subtle))]" />
            <p className="mt-3 text-sm font-medium">No contacts match</p>
            <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
              {rows.length === 0
                ? "Conversations sync from WhatsApp ingest automatically."
                : "Try clearing filters or adjusting the search."}
            </p>
          </CardContent>
        </Card>
      ) : view === "list" ? (
        <ListView orgSlug={orgSlug} rows={filtered} />
      ) : view === "grid" ? (
        <GridView orgSlug={orgSlug} rows={filtered} />
      ) : view === "kanban" ? (
        <KanbanView orgSlug={orgSlug} byStatus={byStatus} />
      ) : (
        <AppointmentsView orgSlug={orgSlug} rows={upcoming} />
      )}
    </div>
  );
}

/* ─── View components ────────────────────────────────────────────────────── */

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))] shadow-sm"
          : "text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon: Icon,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors",
        active
          ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]"
          : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg-muted))] hover:border-[rgb(var(--accent)/0.4)]",
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dot)} /> : null}
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {label}
    </button>
  );
}

function StatusMenu({
  orgSlug,
  customerId,
  current,
  trigger,
}: {
  orgSlug: string;
  customerId: string;
  current: string;
  trigger: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const setStatus = (next: StatusId) => {
    start(async () => {
      const res = await setCustomerStatusAction({
        orgSlug,
        customerId,
        status: next,
      });
      if (res && "error" in res && res.error) toast.error(res.error);
      else toast.success(`Moved to ${STATUSES.find((s) => s.id === next)?.label}`);
    });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Move to…</DropdownMenuLabel>
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => setStatus(s.id)}
            disabled={pending || s.id === current}
          >
            <span className={cn("h-2 w-2 rounded-full", s.color)} />
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListView({ orgSlug, rows }: { orgSlug: string; rows: CrmRow[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[rgb(var(--border))] text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Messages</th>
              <th className="px-4 py-3 font-semibold">Last contact</th>
              <th className="px-4 py-3 font-semibold">Meeting</th>
              <th className="w-24 px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <motion.tbody
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.025 } } }}
          >
            {rows.map((r) => (
              <motion.tr
                key={r.id}
                variants={{
                  hidden: { opacity: 0, x: -4 },
                  show: { opacity: 1, x: 0 },
                }}
                className="border-b border-[rgb(var(--border))] transition-colors hover:bg-[rgb(var(--surface-2))]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/app/${orgSlug}/crm/${r.id}`}
                    className="group flex items-center gap-2.5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                      <User className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block font-medium group-hover:text-[rgb(var(--accent))]">
                        {r.displayName || "Unknown"}
                      </span>
                      <span className="block font-mono text-[11px] text-[rgb(var(--fg-subtle))]">
                        {r.phoneE164}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadge(r.status)} className="text-[10px]">
                    {STATUSES.find((s) => s.id === r.status)?.label ?? r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 py-0.5 text-xs tabular-nums text-[rgb(var(--fg-muted))]">
                    <MessageCircle className="h-3 w-3 text-[rgb(var(--accent))]" />
                    {r.messageCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[rgb(var(--fg-muted))]">
                  {formatShort(r.lastContactedAt)}
                </td>
                <td className="px-4 py-3">
                  {r.meetingBooked ? (
                    <Badge variant="gradient" className="text-[10px]">
                      <Calendar className="mr-1 h-3 w-3" />
                      {r.meetingTime || "Booked"}
                    </Badge>
                  ) : (
                    <span className="text-xs text-[rgb(var(--fg-subtle))]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/app/${orgSlug}/crm/${r.id}`}>Open</Link>
                    </Button>
                    <StatusMenu
                      orgSlug={orgSlug}
                      customerId={r.id}
                      current={r.status}
                      trigger={
                        <Button size="icon" variant="ghost" aria-label="Status menu">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </Card>
  );
}

function GridView({ orgSlug, rows }: { orgSlug: string; rows: CrmRow[] }) {
  return (
    <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => (
        <ContactCard key={r.id} row={r} orgSlug={orgSlug} className="fade-up-item" />
      ))}
    </div>
  );
}

function KanbanView({
  orgSlug,
  byStatus,
}: {
  orgSlug: string;
  byStatus: Record<string, CrmRow[]>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      {STATUSES.map((s) => {
        const col = byStatus[s.id] ?? [];
        return (
          <div
            key={s.id}
            className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-2"
          >
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", s.color)} />
                <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))]">
                  {s.label}
                </p>
              </div>
              <span className="text-[10px] font-medium text-[rgb(var(--fg-subtle))]">
                {col.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {col.length === 0 ? (
                <p className="px-3 py-8 text-center text-[11px] text-[rgb(var(--fg-subtle))]">
                  Empty
                </p>
              ) : (
                col.map((r) => (
                  <ContactCard key={r.id} row={r} orgSlug={orgSlug} compact />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AppointmentsView({
  orgSlug,
  rows,
}: {
  orgSlug: string;
  rows: { row: CrmRow; dt: Date | null }[];
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-[rgb(var(--fg-subtle))]" />
          <p className="mt-3 text-sm font-medium">No meetings booked yet</p>
          <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
            Mark a contact&apos;s meeting field to populate this view.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {rows.map(({ row: r, dt }) => {
        const past = dt ? dt.getTime() < Date.now() : false;
        return (
          <Card key={r.id} className="card-hover">
            <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
              <Link
                href={`/app/${orgSlug}/crm/${r.id}`}
                className="group flex min-w-0 items-center gap-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                  <Calendar className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold group-hover:text-[rgb(var(--accent))]">
                    {r.displayName || "Unknown"}
                  </p>
                  <p className="truncate font-mono text-[11px] text-[rgb(var(--fg-subtle))]">
                    {r.phoneE164}
                  </p>
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={past ? "secondary" : "gradient"}>
                  {r.meetingTime || "Booked"}
                </Badge>
                {dt ? (
                  <Badge variant="outline" className="text-[10px]">
                    {daysAway(dt)}
                  </Badge>
                ) : null}
                <Badge variant={statusBadge(r.status)} className="text-[10px]">
                  {STATUSES.find((s) => s.id === r.status)?.label ?? r.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ContactCard({
  orgSlug,
  row,
  compact,
  className,
}: {
  orgSlug: string;
  row: CrmRow;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("card-hover", className)}>
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/app/${orgSlug}/crm/${row.id}`}
            className="group flex min-w-0 items-center gap-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold group-hover:text-[rgb(var(--accent))]">
                {row.displayName || "Unknown"}
              </p>
              <p className="truncate font-mono text-[10.5px] text-[rgb(var(--fg-subtle))]">
                {row.phoneE164}
              </p>
            </div>
          </Link>
          <StatusMenu
            orgSlug={orgSlug}
            customerId={row.id}
            current={row.status}
            trigger={
              <Button size="icon" variant="ghost" aria-label="Status menu">
                <ChevronDown className="h-4 w-4" />
              </Button>
            }
          />
        </div>

        <div className={cn("mt-3 flex flex-wrap items-center gap-1.5", compact && "mt-2")}>
          <Badge variant={statusBadge(row.status)} className="text-[10px]">
            {STATUSES.find((s) => s.id === row.status)?.label ?? row.status}
          </Badge>
          {row.meetingBooked ? (
            <Badge variant="gradient" className="text-[10px]">
              <Calendar className="mr-1 h-3 w-3" />
              {row.meetingTime || "Booked"}
            </Badge>
          ) : null}
          {(row.tags ?? []).slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>

        {!compact ? (
          <div className="mt-3 flex items-center justify-between text-[11px] text-[rgb(var(--fg-subtle))]">
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {row.messageCount} msg
            </span>
            <span>{formatShort(row.lastContactedAt)}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
