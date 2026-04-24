"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PROVIDER_COLORS: Record<string, string> = {
  groq: "#10b981",
  gemini: "#60a5fa",
  openai: "#a78bfa",
};

export function UsageProviderBar({
  data,
}: {
  data: { provider: string; calls: number; tokens: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
        <XAxis
          dataKey="provider"
          tick={{ fill: "rgb(var(--fg-subtle))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgb(var(--fg-subtle))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
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
        <Bar dataKey="calls" name="Calls" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.provider}
              fill={PROVIDER_COLORS[d.provider] ?? "#a1a1aa"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UsageSuccessPie({
  ok,
  fail,
}: {
  ok: number;
  fail: number;
}) {
  const data = [
    { name: "Succeeded", value: ok },
    { name: "Failed", value: fail },
  ];
  const colors = ["#10b981", "#f87171"];
  if (ok + fail === 0) {
    return (
      <p className="flex h-full items-center justify-center text-xs text-[rgb(var(--fg-subtle))]">
        No calls yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={74}
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "rgb(var(--surface))",
            border: "1px solid rgb(var(--border))",
            borderRadius: 12,
            fontSize: 12,
            color: "rgb(var(--fg))",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
