import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import {
  demoSentiment,
  demoStats,
  demoVolume7d,
} from "@/lib/demo-data";
import { buildDashboardInsights } from "@/lib/dashboard-insights";

function trendPct(current: number, previous: number): number | undefined {
  if (current === 0 && previous === 0) return undefined;
  if (previous === 0) return current > 0 ? 100 : undefined;
  return Math.round(((current - previous) / previous) * 100);
}

export default function DemoDashboardPage() {
  const sentiment = demoSentiment.map((row) => ({
    label: row.label,
    count: row.count,
  }));

  const msgTrend = trendPct(
    demoStats.messages24h,
    demoStats.prevMessages24h,
  );

  const stats = [
    {
      label: "Customers",
      value: demoStats.totalCustomers,
      sub: "total in CRM",
    },
    {
      label: "Messages (24h)",
      value: demoStats.messages24h,
      sub: "in + out",
      trendPct: msgTrend,
    },
    {
      label: "Inbound (24h)",
      value: demoStats.inbound24h,
      sub: "from WhatsApp",
    },
    {
      label: "Outbound (24h)",
      value: demoStats.outbound24h,
      sub: "bot / agent",
    },
  ];

  const insights = buildDashboardInsights({
    messages24h: demoStats.messages24h,
    prevMessages24h: demoStats.prevMessages24h,
    inbound24h: demoStats.inbound24h,
    outbound24h: demoStats.outbound24h,
    totalCustomers: demoStats.totalCustomers,
    newCustomers7d: demoStats.newCustomers7d,
    sentiment,
  });

  return (
    <DashboardAnalytics
      stats={stats}
      volume7d={[...demoVolume7d]}
      sentiment={sentiment}
      insights={insights}
    />
  );
}
