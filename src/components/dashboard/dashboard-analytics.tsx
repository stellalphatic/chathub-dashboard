"use client";

import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
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

export function DashboardAnalytics({
  stats,
  volume7d,
  sentiment,
  insights,
}: {
  stats: StatCardModel[];
  volume7d: { label: string; count: number }[];
  sentiment: { label: string; count: number }[];
  insights: string[];
}) {
  const sentimentTotal = sentiment.reduce((a, s) => a + s.count, 0);
  const pieData = sentiment.map((s) => ({ name: s.label, value: s.count }));

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
