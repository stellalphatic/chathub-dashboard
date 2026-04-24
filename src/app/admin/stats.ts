import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  botConfig,
  botFaq,
  channelConnection,
  conversation,
  customer,
  document,
  llmUsage,
  message,
  organization,
  template,
  user as userTable,
} from "@/db/schema";
import { getServerSession } from "@/lib/session";

async function requirePlatformAdmin() {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const [row] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!row?.platformAdmin) throw new Error("Forbidden");
}

export type OrgStatRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;

  botEnabled: boolean | null;

  // Integration status
  channels: { whatsapp: number; instagram: number; messenger: number };

  // Content counts
  docsIndexed: number;
  docsTotal: number;
  templatesApproved: number;
  templatesTotal: number;
  faqCount: number;

  // Engagement
  customers: number;
  messages24h: number;
  messagesPrev24h: number;
  lastMessageAt: string | null;

  // LLM usage
  llmCalls24h: number;
  llmTokens24h: number;
  llmFail24h: number;
};

export type AdminPlatformStats = {
  businesses: number;
  activeBusinesses24h: number;
  totalCustomers: number;
  messages24h: number;
  messagesPrev24h: number;
  llmCalls24h: number;
  llmTokens24h: number;
  llmFail24h: number;
  volume7d: { day: string; inbound: number; outbound: number }[];
  orgs: OrgStatRow[];
};

/** Return-of-value: a day bucket key (YYYY-MM-DD) in UTC so the sums align. */
function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * Everything the admin home page + per-org cards need, computed in parallel.
 *
 * Scales fine up to ~a few hundred businesses — if you ever grow past that,
 * move to a materialized view and/or a 5-minute cron-refresh cache.
 */
export async function getAdminPlatformStats(): Promise<AdminPlatformStats> {
  await requirePlatformAdmin();

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 3600 * 1000);
  const since48h = new Date(now.getTime() - 48 * 3600 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  since7d.setUTCHours(0, 0, 0, 0);

  const [
    orgs,
    customerRows,
    msg24h,
    msgPrev24h,
    msgLast,
    botRows,
    channelRows,
    docRows,
    tplRows,
    faqRows,
    llm24h,
    volumeRows,
  ] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .orderBy(asc(organization.name)),
    db
      .select({ organizationId: customer.organizationId, n: count() })
      .from(customer)
      .groupBy(customer.organizationId),
    db
      .select({
        organizationId: message.organizationId,
        n: count(),
        last: sql<Date>`max(${message.createdAt})`,
      })
      .from(message)
      .where(gte(message.createdAt, since24h))
      .groupBy(message.organizationId),
    db
      .select({
        organizationId: message.organizationId,
        n: count(),
      })
      .from(message)
      .where(
        and(gte(message.createdAt, since48h), sql`${message.createdAt} < ${since24h}`),
      )
      .groupBy(message.organizationId),
    db
      .select({
        organizationId: message.organizationId,
        last: sql<Date>`max(${message.createdAt})`,
      })
      .from(message)
      .groupBy(message.organizationId),
    db
      .select({
        organizationId: botConfig.organizationId,
        enabled: botConfig.enabled,
      })
      .from(botConfig),
    db
      .select({
        organizationId: channelConnection.organizationId,
        channel: channelConnection.channel,
        n: count(),
      })
      .from(channelConnection)
      .groupBy(channelConnection.organizationId, channelConnection.channel),
    db
      .select({
        organizationId: document.organizationId,
        status: document.status,
        n: count(),
      })
      .from(document)
      .groupBy(document.organizationId, document.status),
    db
      .select({
        organizationId: template.organizationId,
        status: template.status,
        n: count(),
      })
      .from(template)
      .groupBy(template.organizationId, template.status),
    db
      .select({
        organizationId: botFaq.organizationId,
        n: count(),
      })
      .from(botFaq)
      .groupBy(botFaq.organizationId),
    db
      .select({
        organizationId: llmUsage.organizationId,
        calls: count(),
        tokens: sql<number>`coalesce(sum(${llmUsage.totalTokens}), 0)`,
        fails: sql<number>`count(*) filter (where ${llmUsage.succeeded} = false)`,
      })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, since24h))
      .groupBy(llmUsage.organizationId),
    db
      .select({
        day: sql<string>`to_char(${message.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        direction: message.direction,
        n: count(),
      })
      .from(message)
      .where(gte(message.createdAt, since7d))
      .groupBy(
        sql`to_char(${message.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        message.direction,
      ),
  ]);

  const customerMap = new Map(customerRows.map((r) => [r.organizationId, Number(r.n)]));
  const msg24Map = new Map(
    msg24h.map((r) => [r.organizationId, Number(r.n)]),
  );
  const msgPrevMap = new Map(
    msgPrev24h.map((r) => [r.organizationId, Number(r.n)]),
  );
  const msgLastMap = new Map(
    msgLast.map((r) => [r.organizationId, r.last ? new Date(r.last) : null]),
  );
  const botMap = new Map(botRows.map((r) => [r.organizationId, r.enabled]));

  const chMap = new Map<
    string,
    { whatsapp: number; instagram: number; messenger: number }
  >();
  for (const r of channelRows) {
    const cur = chMap.get(r.organizationId) ?? {
      whatsapp: 0,
      instagram: 0,
      messenger: 0,
    };
    if (r.channel === "whatsapp") cur.whatsapp = Number(r.n);
    else if (r.channel === "instagram") cur.instagram = Number(r.n);
    else if (r.channel === "messenger") cur.messenger = Number(r.n);
    chMap.set(r.organizationId, cur);
  }

  const docMap = new Map<string, { indexed: number; total: number }>();
  for (const r of docRows) {
    const cur = docMap.get(r.organizationId) ?? { indexed: 0, total: 0 };
    cur.total += Number(r.n);
    if (r.status === "indexed") cur.indexed += Number(r.n);
    docMap.set(r.organizationId, cur);
  }

  const tplMap = new Map<string, { approved: number; total: number }>();
  for (const r of tplRows) {
    const cur = tplMap.get(r.organizationId) ?? { approved: 0, total: 0 };
    cur.total += Number(r.n);
    if (r.status === "approved") cur.approved += Number(r.n);
    tplMap.set(r.organizationId, cur);
  }

  const faqMap = new Map(faqRows.map((r) => [r.organizationId, Number(r.n)]));
  const llmMap = new Map(
    llm24h.map((r) => [
      r.organizationId,
      { calls: Number(r.calls), tokens: Number(r.tokens), fails: Number(r.fails) },
    ]),
  );

  const statOrgs: OrgStatRow[] = orgs.map((o) => {
    const docs = docMap.get(o.id) ?? { indexed: 0, total: 0 };
    const tpls = tplMap.get(o.id) ?? { approved: 0, total: 0 };
    const ch = chMap.get(o.id) ?? { whatsapp: 0, instagram: 0, messenger: 0 };
    const llm = llmMap.get(o.id) ?? { calls: 0, tokens: 0, fails: 0 };
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      createdAt: o.createdAt.toISOString(),
      botEnabled: botMap.get(o.id) ?? null,
      channels: ch,
      docsIndexed: docs.indexed,
      docsTotal: docs.total,
      templatesApproved: tpls.approved,
      templatesTotal: tpls.total,
      faqCount: faqMap.get(o.id) ?? 0,
      customers: customerMap.get(o.id) ?? 0,
      messages24h: msg24Map.get(o.id) ?? 0,
      messagesPrev24h: msgPrevMap.get(o.id) ?? 0,
      lastMessageAt: msgLastMap.get(o.id)?.toISOString() ?? null,
      llmCalls24h: llm.calls,
      llmTokens24h: llm.tokens,
      llmFail24h: llm.fails,
    };
  });

  // Fill 7-day volume (inbound/outbound) across the platform
  const volumeByDay = new Map<
    string,
    { inbound: number; outbound: number }
  >();
  for (let i = 0; i < 7; i++) {
    const d = new Date(since7d.getTime() + i * 24 * 3600 * 1000);
    volumeByDay.set(dayKey(d), { inbound: 0, outbound: 0 });
  }
  for (const r of volumeRows) {
    const cur = volumeByDay.get(r.day) ?? { inbound: 0, outbound: 0 };
    if (r.direction === "inbound") cur.inbound += Number(r.n);
    else if (r.direction === "outbound") cur.outbound += Number(r.n);
    volumeByDay.set(r.day, cur);
  }

  const volume7d = Array.from(volumeByDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({
      day: new Date(day + "T00:00:00Z").toLocaleDateString(undefined, {
        weekday: "short",
      }),
      inbound: v.inbound,
      outbound: v.outbound,
    }));

  const totalMessages24h = statOrgs.reduce((a, o) => a + o.messages24h, 0);
  const totalMessagesPrev = statOrgs.reduce(
    (a, o) => a + o.messagesPrev24h,
    0,
  );
  const totalCustomers = statOrgs.reduce((a, o) => a + o.customers, 0);
  const activeBusinesses24h = statOrgs.filter((o) => o.messages24h > 0).length;
  const llmCalls24h = statOrgs.reduce((a, o) => a + o.llmCalls24h, 0);
  const llmTokens24h = statOrgs.reduce((a, o) => a + o.llmTokens24h, 0);
  const llmFail24h = statOrgs.reduce((a, o) => a + o.llmFail24h, 0);

  // Sort by engagement (last message desc, then messages24h desc)
  statOrgs.sort((a, b) => {
    const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    if (bt !== at) return bt - at;
    return b.messages24h - a.messages24h;
  });

  return {
    businesses: statOrgs.length,
    activeBusinesses24h,
    totalCustomers,
    messages24h: totalMessages24h,
    messagesPrev24h: totalMessagesPrev,
    llmCalls24h,
    llmTokens24h,
    llmFail24h,
    volume7d,
    orgs: statOrgs,
  };
}

void desc; // keep import used (types only otherwise)
