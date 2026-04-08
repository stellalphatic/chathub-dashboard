import { and, count, eq, gte } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customer, message, organization } from "@/db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);
  if (!org) notFound();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [{ totalCustomers }] = await db
    .select({ totalCustomers: count() })
    .from(customer)
    .where(eq(customer.organizationId, org.id));

  const [{ messages24h }] = await db
    .select({ messages24h: count() })
    .from(message)
    .where(
      and(eq(message.organizationId, org.id), gte(message.createdAt, since)),
    );

  const [{ inbound24h }] = await db
    .select({ inbound24h: count() })
    .from(message)
    .where(
      and(
        eq(message.organizationId, org.id),
        gte(message.createdAt, since),
        eq(message.direction, "inbound"),
      ),
    );

  const [{ outbound24h }] = await db
    .select({ outbound24h: count() })
    .from(message)
    .where(
      and(
        eq(message.organizationId, org.id),
        gte(message.createdAt, since),
        eq(message.direction, "outbound"),
      ),
    );

  const sentimentRows = await db
    .select({ sentiment: message.sentiment, c: count() })
    .from(message)
    .where(
      and(eq(message.organizationId, org.id), gte(message.createdAt, since)),
    )
    .groupBy(message.sentiment);

  const stats = [
    { label: "Customers", value: totalCustomers, sub: "total in CRM" },
    { label: "Messages (24h)", value: messages24h, sub: "in + out" },
    { label: "Inbound (24h)", value: inbound24h, sub: "from WhatsApp" },
    { label: "Outbound (24h)", value: outbound24h, sub: "bot / agent" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sentiment (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          {sentimentRows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No labeled messages yet. Send{" "}
              <code className="text-emerald-400">sentiment</code> from n8n when
              you classify replies.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {sentimentRows.map((row) => (
                <div
                  key={String(row.sentiment)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {row.sentiment ?? "unknown"}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">{row.c}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
