import { and, count, eq, gte, lt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import { db } from "@/db";
import { customer, message, organization } from "@/db/schema";
import { assertOrgPage } from "@/lib/org-access";
import {
  bucketMessageDates,
  buildDashboardInsights,
  fillLastNDaysVolume,
} from "@/lib/dashboard-insights";

function trendPct(current: number, previous: number): number | undefined {
  if (current === 0 && previous === 0) return undefined;
  if (previous === 0) return current > 0 ? 100 : undefined;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgPage(orgSlug, "overview", "view");

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since48h = new Date(now - 48 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  since7d.setUTCHours(0, 0, 0, 0);

  const [{ totalCustomers }] = await db
    .select({ totalCustomers: count() })
    .from(customer)
    .where(eq(customer.organizationId, org.id));

  const [{ messages24h }] = await db
    .select({ messages24h: count() })
    .from(message)
    .where(
      and(eq(message.organizationId, org.id), gte(message.createdAt, since24h)),
    );

  const [{ prevMessages24h }] = await db
    .select({ prevMessages24h: count() })
    .from(message)
    .where(
      and(
        eq(message.organizationId, org.id),
        gte(message.createdAt, since48h),
        lt(message.createdAt, since24h),
      ),
    );

  const [{ inbound24h }] = await db
    .select({ inbound24h: count() })
    .from(message)
    .where(
      and(
        eq(message.organizationId, org.id),
        gte(message.createdAt, since24h),
        eq(message.direction, "inbound"),
      ),
    );

  const [{ outbound24h }] = await db
    .select({ outbound24h: count() })
    .from(message)
    .where(
      and(
        eq(message.organizationId, org.id),
        gte(message.createdAt, since24h),
        eq(message.direction, "outbound"),
      ),
    );

  const [{ newCustomers7d }] = await db
    .select({ newCustomers7d: count() })
    .from(customer)
    .where(
      and(
        eq(customer.organizationId, org.id),
        gte(customer.createdAt, since7d),
      ),
    );

  const sentimentRows = await db
    .select({ sentiment: message.sentiment, c: count() })
    .from(message)
    .where(
      and(eq(message.organizationId, org.id), gte(message.createdAt, since24h)),
    )
    .groupBy(message.sentiment);

  const volumeRows = await db
    .select({ createdAt: message.createdAt })
    .from(message)
    .where(
      and(eq(message.organizationId, org.id), gte(message.createdAt, since7d)),
    );

  // Extra breakdowns for the interactive donut row
  const channelRows = await db
    .select({ channel: message.channel, c: count() })
    .from(message)
    .where(
      and(eq(message.organizationId, org.id), gte(message.createdAt, since24h)),
    )
    .groupBy(message.channel);

  const replyRows = await db
    .select({ sentByBot: message.sentByBot, c: count() })
    .from(message)
    .where(
      and(
        eq(message.organizationId, org.id),
        gte(message.createdAt, since24h),
        eq(message.direction, "outbound"),
      ),
    )
    .groupBy(message.sentByBot);

  const hourRows = await db
    .select({ createdAt: message.createdAt })
    .from(message)
    .where(
      and(eq(message.organizationId, org.id), gte(message.createdAt, since24h)),
    );

  const volume7d = fillLastNDaysVolume(bucketMessageDates(volumeRows), 7).map(
    ({ label, count: c }) => ({ label, count: c }),
  );

  const sentiment = sentimentRows.map((row) => ({
    label: String(row.sentiment ?? "unknown"),
    count: row.c,
  }));

  const msgTrend = trendPct(messages24h, prevMessages24h);

  const stats = [
    {
      label: "Customers",
      value: totalCustomers,
      sub: "total in CRM",
    },
    {
      label: "Messages (24h)",
      value: messages24h,
      sub: "in + out",
      trendPct: msgTrend,
    },
    {
      label: "Inbound (24h)",
      value: inbound24h,
      sub: "from WhatsApp",
    },
    {
      label: "Outbound (24h)",
      value: outbound24h,
      sub: "bot / agent",
    },
  ];

  const channels = channelRows
    .map((r) => ({ channel: String(r.channel ?? "other"), count: r.c }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const who = replyRows.reduce(
    (acc, r) => {
      if (r.sentByBot) acc.bot += r.c;
      else acc.human += r.c;
      return acc;
    },
    { bot: 0, human: 0 },
  );

  const hourlyBuckets = new Array(24).fill(0) as number[];
  for (const r of hourRows) {
    const d = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
    hourlyBuckets[d.getHours()] += 1;
  }
  const hourly = hourlyBuckets.map((count, i) => ({
    hour: `${i.toString().padStart(2, "0")}h`,
    count,
  }));

  const insights = buildDashboardInsights({
    messages24h,
    prevMessages24h,
    inbound24h,
    outbound24h,
    totalCustomers,
    newCustomers7d,
    sentiment,
  });

  return (
    <DashboardAnalytics
      stats={stats}
      volume7d={volume7d}
      sentiment={sentiment}
      insights={insights}
      direction={{ inbound: inbound24h, outbound: outbound24h }}
      channels={channels}
      who={who}
      hourly={hourly}
    />
  );
}
