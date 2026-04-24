"use client";

import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bot,
  Gauge,
  MessageSquare,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardModel = {
  label: string;
  value: number;
  sub: string;
  trendPct?: number;
};

const CHART = {
  accent: "#10b981",
  accent2: "#14b8a6",
  muted: "rgb(var(--fg-subtle))",
  pie: ["#34d399", "#60a5fa", "#f59e0b", "#f87171", "#a1a1aa"],
  direction: { inbound: "#60a5fa", outbound: "#34d399" },
  channel: {
    whatsapp: "#22c55e",
    instagram: "#e1306c",
    messenger: "#0084ff",
    sms: "#f59e0b",
    voice: "#a855f7",
    other: "#a1a1aa",
  } as Record<string, string>,
  who: { bot: "#14b8a6", human: "#f59e0b" },
};

const tooltipStyle = {
  background: "rgb(var(--surface))",
  border: "1px solid rgb(var(--border))",
  borderRadius: "12px",
  fontSize: 12,
  color: "rgb(var(--fg))",
};

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        up
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          : "bg-rose-500/15 text-rose-600 dark:text-rose-300",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

export type DirectionBreakdown = { inbound: number; outbound: number };
export type ChannelBreakdown = { channel: string; count: number }[];
export type WhoBreakdown = { bot: number; human: number };

export function DashboardAnalytics({
  stats,
  volume7d,
  sentiment,
  insights,
  direction,
  channels,
  who,
  hourly,
}: {
  stats: StatCardModel[];
  volume7d: { label: string; count: number }[];
  sentiment: { label: string; count: number }[];
  insights: string[];
  direction?: DirectionBreakdown;
  channels?: ChannelBreakdown;
  who?: WhoBreakdown;
  hourly?: { hour: string; count: number }[];
}) {
  const sentimentTotal = sentiment.reduce((a, s) => a + s.count, 0);
  const pieData = sentiment.map((s) => ({ name: s.label, value: s.count }));

  const directionData = direction
    ? [
        { name: "Inbound", value: direction.inbound, color: CHART.direction.inbound },
        { name: "Outbound", value: direction.outbound, color: CHART.direction.outbound },
      ]
    : [];
  const directionTotal =
    directionData.reduce((a, b) => a + b.value, 0) || 0;

  const channelData = (channels ?? []).map((c) => ({
    name: c.channel,
    value: c.count,
    color: CHART.channel[c.channel] ?? CHART.channel.other,
  }));
  const channelTotal = channelData.reduce((a, b) => a + b.value, 0);

  const whoTotal = who ? who.bot + who.human : 0;
  const aiCoverage = whoTotal > 0 ? Math.round((who!.bot / whoTotal) * 100) : 0;
  const radialData = [
    {
      name: "coverage",
      value: aiCoverage,
      fill: "url(#ai-grad)",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="fade-up-item"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <Card className="h-full card-hover">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                  {s.label}
                </CardTitle>
                {s.trendPct !== undefined ? <TrendBadge pct={s.trendPct} /> : null}
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-[rgb(var(--fg))]">
                  {s.value.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">{s.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Message volume (7 days)</CardTitle>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">
                All directions — inbound + outbound combined
              </p>
            </CardHeader>
            <CardContent className="h-64 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume7d} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgb(var(--fg-subtle))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgb(var(--fg-subtle))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgb(var(--surface))",
                      border: "1px solid rgb(var(--border))",
                      borderRadius: "12px",
                      fontSize: 12,
                      color: "rgb(var(--fg))",
                    }}
                    labelStyle={{ color: "rgb(var(--fg-muted))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={CHART.accent}
                    strokeWidth={2}
                    fill="url(#volFill)"
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Sentiment (24h)</CardTitle>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">
                When your agent / workflow labels replies
              </p>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-4 pt-0">
              {sentimentTotal === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-[rgb(var(--fg-subtle))]">
                  No labeled messages yet. Sentiment appears here once replies get classified.
                </p>
              ) : (
                <>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={3}
                          animationDuration={700}
                        >
                          {pieData.map((entry, idx) => (
                            <Cell
                              key={`${entry.name}-${idx}`}
                              fill={CHART.pie[idx % CHART.pie.length]}
                              stroke="transparent"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "rgb(var(--surface))",
                            border: "1px solid rgb(var(--border))",
                            borderRadius: "12px",
                            fontSize: 12,
                            color: "rgb(var(--fg))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex w-full flex-wrap justify-center gap-2 text-xs">
                    {sentiment.map((row, idx) => (
                      <li
                        key={row.label}
                        className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: CHART.pie[idx % CHART.pie.length],
                          }}
                        />
                        <span className="capitalize text-[rgb(var(--fg-muted))]">
                          {row.label}
                        </span>
                        <span className="font-semibold tabular-nums text-[rgb(var(--fg))]">
                          {row.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {(direction || channels || who || hourly) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {direction && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="card-hover h-full">
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm">Direction (24h)</CardTitle>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">
                      Inbound vs outbound mix
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {directionTotal === 0 ? (
                    <p className="py-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
                      No messages yet today.
                    </p>
                  ) : (
                    <div className="relative h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={directionData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={46}
                            outerRadius={70}
                            paddingAngle={3}
                            animationDuration={700}
                          >
                            {directionData.map((d) => (
                              <Cell key={d.name} fill={d.color} stroke="transparent" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-semibold tabular-nums text-[rgb(var(--fg))]">
                          {directionTotal}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                          messages
                        </span>
                      </div>
                    </div>
                  )}
                  <ul className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                    {directionData.map((d) => (
                      <li
                        key={d.name}
                        className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-[rgb(var(--fg-muted))]">{d.name}</span>
                        <span className="font-semibold tabular-nums">{d.value}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {channels && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <Card className="card-hover h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Channel mix (24h)</CardTitle>
                  <p className="text-xs text-[rgb(var(--fg-subtle))]">
                    Where your conversations happen
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  {channelTotal === 0 ? (
                    <p className="py-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
                      No channel activity yet.
                    </p>
                  ) : (
                    <>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={channelData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={46}
                              outerRadius={70}
                              paddingAngle={2}
                              animationDuration={700}
                            >
                              {channelData.map((c) => (
                                <Cell
                                  key={c.name}
                                  fill={c.color}
                                  stroke="transparent"
                                />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                        {channelData.map((c) => (
                          <li
                            key={c.name}
                            className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="capitalize text-[rgb(var(--fg-muted))]">
                              {c.name}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {c.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {who && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.21 }}
            >
              <Card className="card-hover h-full">
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">AI coverage (24h)</CardTitle>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">
                      Share of outbound replies by bot
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {whoTotal === 0 ? (
                    <p className="py-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
                      No outbound replies in the last 24h.
                    </p>
                  ) : (
                    <div className="relative h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          cx="50%"
                          cy="55%"
                          innerRadius="68%"
                          outerRadius="100%"
                          startAngle={210}
                          endAngle={-30}
                          data={radialData}
                        >
                          <defs>
                            <linearGradient
                              id="ai-grad"
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="rgb(var(--brand-from))"
                              />
                              <stop
                                offset="100%"
                                stopColor="rgb(var(--brand-to))"
                              />
                            </linearGradient>
                          </defs>
                          <RadialBar
                            background={{ fill: "rgb(var(--surface-2))" }}
                            dataKey="value"
                            cornerRadius={12}
                            animationDuration={800}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-semibold tabular-nums text-[rgb(var(--fg))]">
                          {aiCoverage}%
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                          {who.bot}/{whoTotal} replies
                        </span>
                      </div>
                    </div>
                  )}
                  <ul className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                    <li className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CHART.who.bot }}
                      />
                      <span className="text-[rgb(var(--fg-muted))]">Bot</span>
                      <span className="font-semibold tabular-nums">{who.bot}</span>
                    </li>
                    <li className="flex items-center gap-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2.5 py-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CHART.who.human }}
                      />
                      <span className="text-[rgb(var(--fg-muted))]">Human</span>
                      <span className="font-semibold tabular-nums">
                        {who.human}
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {hourly && hourly.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]">
                <Gauge className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm">Hourly activity (24h)</CardTitle>
                <p className="text-xs text-[rgb(var(--fg-subtle))]">
                  Peak hours for incoming conversations
                </p>
              </div>
            </CardHeader>
            <CardContent className="h-44 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hourly}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={CHART.accent2} stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgb(var(--border))"
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "rgb(var(--fg-subtle))", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fill: "rgb(var(--fg-subtle))", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="count"
                    fill="url(#hourFill)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={700}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="overflow-hidden border-[rgb(var(--accent)/0.3)]">
          <div aria-hidden className="h-0.5 w-full gradient-brand" />
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Insight highlights</CardTitle>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">
                Pattern notes from your last 24 hours
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.map((line, i) => (
                <motion.li
                  key={i}
                  className="flex gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5 text-sm text-[rgb(var(--fg))]"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                >
                  <span className="mt-0.5 font-mono text-xs text-[rgb(var(--accent))]">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <span>{line}</span>
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
