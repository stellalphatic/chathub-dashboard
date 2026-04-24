import Link from "next/link";
import {
  ArrowRight,
  BookText,
  Bot,
  Building2,
  CheckCircle2,
  Cpu,
  Facebook,
  FileText,
  Instagram,
  MessageCircle,
  Plug,
  Plus,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { getAdminPlatformStats, type AdminPlatformStats, type OrgStatRow } from "@/app/admin/stats";

async function safeGetAdminPlatformStats(): Promise<
  | { ok: true; data: AdminPlatformStats }
  | { ok: false; error: string }
> {
  try {
    const data = await getAdminPlatformStats();
    return { ok: true, data };
  } catch (e) {
    console.error("[admin/overview] stats failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlatformVolumeChart } from "@/components/admin/platform-volume-chart";
import { cn } from "@/lib/utils";

function trendPct(cur: number, prev: number): number | null {
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export default async function AdminHomePage() {
  const res = await safeGetAdminPlatformStats();
  if (!res.ok) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Platform overview
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--fg-muted))] sm:text-base">
              Analytics are temporarily unavailable.
            </p>
          </div>
          <Button asChild variant="gradient">
            <Link href="/admin/organizations/new">
              <Plus className="h-4 w-4" /> New business
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium text-rose-500">Failed to load stats</p>
            <p className="font-mono text-xs text-[rgb(var(--fg-muted))]">
              {res.error}
            </p>
            <p className="text-xs text-[rgb(var(--fg-subtle))]">
              This admin page keeps working even when analytics fail. Check the worker logs
              or Supabase status and refresh.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  const stats = res.data;

  const msgTrend = trendPct(stats.messages24h, stats.messagesPrev24h);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Platform overview
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--fg-muted))] sm:text-base">
            Every business, every integration, every message — at a glance. Click a card to
            drill into its configuration.
          </p>
        </div>
        <Button asChild variant="gradient" className="w-full sm:w-auto">
          <Link href="/admin/organizations/new">
            <Plus className="h-4 w-4" /> New business
          </Link>
        </Button>
      </div>

      {/* KPI strip */}
      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Businesses"
          value={stats.businesses}
          sub={`${stats.activeBusinesses24h} active today`}
          icon={Building2}
          tint="text-sky-500"
        />
        <KpiCard
          label="Messages (24h)"
          value={compact(stats.messages24h)}
          sub="inbound + outbound"
          icon={MessageCircle}
          tint="text-emerald-500"
          trend={msgTrend}
        />
        <KpiCard
          label="Customers"
          value={compact(stats.totalCustomers)}
          sub="across all orgs"
          icon={Users}
          tint="text-violet-500"
        />
        <KpiCard
          label="LLM calls (24h)"
          value={compact(stats.llmCalls24h)}
          sub={`${compact(stats.llmTokens24h)} tokens`}
          icon={Cpu}
          tint="text-amber-500"
        />
        <KpiCard
          label="Failed LLM (24h)"
          value={compact(stats.llmFail24h)}
          sub={stats.llmFail24h > 0 ? "check admin/usage" : "all good"}
          icon={Zap}
          tint={stats.llmFail24h > 0 ? "text-rose-500" : "text-emerald-500"}
        />
      </div>

      {/* Volume chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message volume — last 7 days</CardTitle>
          <CardDescription>
            Inbound (from customers) vs outbound (AI + agent) across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 pt-0">
          <PlatformVolumeChart data={stats.volume7d} />
        </CardContent>
      </Card>

      {/* Businesses — rich cards */}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Businesses ({stats.businesses})
          </h2>
          <p className="text-xs text-[rgb(var(--fg-subtle))]">
            Sorted by most recent activity
          </p>
        </div>
        {stats.orgs.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Building2 className="mx-auto h-8 w-8 text-[rgb(var(--fg-subtle))]" />
              <p className="mt-3 text-sm font-medium">No businesses yet</p>
              <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
                Create one to start wiring up channels and bots.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="stagger grid gap-4 lg:grid-cols-2">
            {stats.orgs.map((o) => (
              <OrgCard key={o.id} row={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tint,
  trend,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  trend?: number | null;
}) {
  return (
    <Card className="fade-up-item card-hover h-full">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[rgb(var(--fg-muted))]">
            <span className="truncate">{sub}</span>
            {typeof trend === "number" ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  trend >= 0
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-300",
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend >= 0 ? "+" : ""}
                {trend}%
              </span>
            ) : null}
          </div>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))]",
            tint,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function OrgCard({ row: o }: { row: OrgStatRow }) {
  const totalChannels = o.channels.whatsapp + o.channels.instagram + o.channels.messenger;
  const health =
    totalChannels === 0
      ? { label: "Unconfigured", variant: "secondary" as const, tint: "bg-zinc-400" }
      : o.botEnabled === null
        ? { label: "No bot yet", variant: "warning" as const, tint: "bg-amber-500" }
        : o.botEnabled
          ? { label: "Live", variant: "success" as const, tint: "bg-emerald-500" }
          : { label: "Bot paused", variant: "secondary" as const, tint: "bg-zinc-400" };

  const trend = trendPct(o.messages24h, o.messagesPrev24h);
  const fairDocs = o.docsTotal > 0 && o.docsIndexed < o.docsTotal;
  const hasChannels = totalChannels > 0;

  return (
    <Card className="fade-up-item card-hover">
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Link
                href={`/admin/organizations/${o.id}`}
                className="block truncate text-base font-semibold tracking-tight hover:text-[rgb(var(--accent))]"
              >
                {o.name}
              </Link>
              <p className="truncate font-mono text-[10.5px] text-[rgb(var(--fg-subtle))]">
                {o.slug}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={health.variant}>
              <span className={cn("mr-1 h-1.5 w-1.5 rounded-full", health.tint)} />
              {health.label}
            </Badge>
            <span className="text-[10px] text-[rgb(var(--fg-subtle))]">
              last msg {timeAgo(o.lastMessageAt)}
            </span>
          </div>
        </div>

        {/* Integrations row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <IntegrationChip
            icon={MessageCircle}
            label="WhatsApp"
            connected={o.channels.whatsapp > 0}
            count={o.channels.whatsapp}
            activeTint="text-emerald-500"
          />
          <IntegrationChip
            icon={Instagram}
            label="Instagram"
            connected={o.channels.instagram > 0}
            count={o.channels.instagram}
            activeTint="text-pink-500"
          />
          <IntegrationChip
            icon={Facebook}
            label="Messenger"
            connected={o.channels.messenger > 0}
            count={o.channels.messenger}
            activeTint="text-blue-500"
          />
        </div>

        {/* Config row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ConfigChip
            icon={Bot}
            label={
              o.botEnabled === null
                ? "Bot — not set"
                : o.botEnabled
                  ? "Bot on"
                  : "Bot paused"
            }
            variant={
              o.botEnabled === null
                ? "secondary"
                : o.botEnabled
                  ? "success"
                  : "warning"
            }
          />
          <ConfigChip
            icon={BookText}
            label={
              o.docsTotal === 0
                ? "No docs"
                : `${o.docsIndexed}/${o.docsTotal} docs`
            }
            variant={
              o.docsTotal === 0
                ? "secondary"
                : fairDocs
                  ? "warning"
                  : "success"
            }
          />
          <ConfigChip
            icon={FileText}
            label={
              o.templatesTotal === 0
                ? "No templates"
                : `${o.templatesApproved}/${o.templatesTotal} approved`
            }
            variant={
              o.templatesTotal === 0
                ? "secondary"
                : o.templatesApproved > 0
                  ? "success"
                  : "warning"
            }
          />
          {o.faqCount > 0 ? (
            <ConfigChip
              icon={CheckCircle2}
              label={`${o.faqCount} FAQs`}
              variant="success"
            />
          ) : null}
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Customers" value={compact(o.customers)} />
          <MiniStat
            label="Msgs 24h"
            value={compact(o.messages24h)}
            trend={trend}
          />
          <MiniStat label="LLM calls" value={compact(o.llmCalls24h)} />
          <MiniStat
            label="LLM fails"
            value={compact(o.llmFail24h)}
            tint={o.llmFail24h > 0 ? "text-rose-500" : undefined}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/admin/organizations/${o.id}`}>
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/app/${o.slug}/channels`}>
              <Plug className="h-3 w-3" /> Channels
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/app/${o.slug}/bot`}>
              <Bot className="h-3 w-3" /> Bot
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/app/${o.slug}`}>
              <ArrowRight className="h-3 w-3" /> Dashboard
            </Link>
          </Button>
          {!hasChannels ? (
            <span className="ml-auto text-[10px] text-amber-500">
              Setup not started
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationChip({
  icon: Icon,
  label,
  connected,
  count,
  activeTint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  connected: boolean;
  count: number;
  activeTint: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]",
        connected
          ? "border-[rgb(var(--accent)/0.35)] bg-[rgb(var(--accent)/0.08)] text-[rgb(var(--fg))]"
          : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-subtle))]",
      )}
    >
      <Icon className={cn("h-3 w-3", connected ? activeTint : "")} />
      {label}
      {connected ? (
        <span className="rounded-full bg-[rgb(var(--accent))] px-1 text-[9px] font-semibold text-[rgb(var(--accent-fg))]">
          {count}
        </span>
      ) : null}
    </span>
  );
}

function ConfigChip({
  icon: Icon,
  label,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant: "success" | "warning" | "secondary";
}) {
  const cls =
    variant === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : variant === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-subtle))]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]",
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function MiniStat({
  label,
  value,
  trend,
  tint,
}: {
  label: string;
  value: string;
  trend?: number | null;
  tint?: string;
}) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums text-[rgb(var(--fg))]",
          tint,
        )}
      >
        {value}
      </p>
      {typeof trend === "number" ? (
        <p
          className={cn(
            "text-[9px] font-medium",
            trend >= 0 ? "text-emerald-500" : "text-rose-500",
          )}
        >
          {trend >= 0 ? "+" : ""}
          {trend}%
        </p>
      ) : null}
    </div>
  );
}
