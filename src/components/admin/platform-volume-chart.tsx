"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function PlatformVolumeChart({
  data,
}: {
  data: { day: string; inbound: number; outbound: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
        <XAxis
          dataKey="day"
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
            borderRadius: 12,
            fontSize: 12,
            color: "rgb(var(--fg))",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "rgb(var(--fg-muted))" }} />
        <Area
          type="monotone"
          dataKey="inbound"
          name="Inbound"
          stroke="#34d399"
          strokeWidth={2}
          fill="url(#inFill)"
          animationDuration={700}
        />
        <Area
          type="monotone"
          dataKey="outbound"
          name="Outbound"
          stroke="#60a5fa"
          strokeWidth={2}
          fill="url(#outFill)"
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
