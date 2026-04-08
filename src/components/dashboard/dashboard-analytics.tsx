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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardModel = {
  label: string;
  value: number;
  sub: string;
  trendPct?: number;
};

const CHART_COLORS = {
  grid: "rgba(255,255,255,0.06)",
  axis: "#71717a",
  accent: "#10b981",
  pie: ["#34d399", "#a1a1aa", "#f87171", "#60a5fa"],
};

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        up
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-rose-500/15 text-rose-300",
      )}
    >
      {up ? (
        <TrendingUp className="size-3" aria-hidden />
      ) : (
        <TrendingDown className="size-3" aria-hidden />
      )}
      {up ? "+" : ""}
      {pct}%
      <span className="sr-only"> vs prior 24 hours</span>
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
  const pieData = sentiment.map((s) => ({
    name: s.label,
    value: s.count,
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
          >
            <Card className="h-full overflow-hidden border-white/10 bg-zinc-900/40 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  {s.label}
                </CardTitle>
                {s.trendPct !== undefined ? (
                  <TrendBadge pct={s.trendPct} />
                ) : null}
              </CardHeader>
              <CardContent>
                <motion.p
                  className="text-3xl font-semibold tabular-nums text-white"
                  initial={{ scale: 0.92 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 24 }}
                >
                  {s.value}
                </motion.p>
                <p className="mt-1 text-xs text-zinc-500">{s.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-white/10 bg-zinc-900/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Message volume (7 days)</CardTitle>
              <p className="text-xs text-zinc-500">
                All directions — powered by your live thread data
              </p>
            </CardHeader>
            <CardContent className="h-64 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume7d} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2}
                    fill="url(#volFill)"
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full border-white/10 bg-zinc-900/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">Sentiment (24h)</CardTitle>
              <p className="text-xs text-zinc-500">When n8n sends labels</p>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-4 pt-0">
              {sentimentTotal === 0 ? (
                <p className="text-center text-sm text-zinc-500 px-2">
                  No labeled messages yet. Send{" "}
                  <code className="text-emerald-400">sentiment</code> from n8n when you classify
                  replies.
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
                              fill={CHART_COLORS.pie[idx % CHART_COLORS.pie.length]}
                              stroke="transparent"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#18181b",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex w-full flex-wrap justify-center gap-2 text-xs">
                    {sentiment.map((row, idx) => (
                      <li
                        key={row.label}
                        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor:
                              CHART_COLORS.pie[idx % CHART_COLORS.pie.length],
                          }}
                        />
                        <span className="capitalize text-zinc-400">{row.label}</span>
                        <span className="font-semibold tabular-nums text-white">
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-zinc-900/50 to-zinc-950/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Insight assistant</CardTitle>
              <p className="text-xs text-zinc-500">
                Rule-based highlights from your metrics (ready for an LLM layer later)
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {insights.map((line, i) => (
                <motion.li
                  key={i}
                  className="flex gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-sm text-zinc-200"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                >
                  <span className="mt-0.5 font-mono text-xs text-emerald-500/80">
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
