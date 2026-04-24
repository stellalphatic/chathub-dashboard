import { desc, sql } from "drizzle-orm";
import { CheckCircle2, Cpu, XCircle, Zap } from "lucide-react";
import { db } from "@/db";
import { llmUsage, organization } from "@/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsageProviderBar, UsageSuccessPie } from "@/components/admin/usage-chart";

export default async function UsagePage() {
  const last200 = await db
    .select({
      id: llmUsage.id,
      orgId: llmUsage.organizationId,
      orgName: organization.name,
      provider: llmUsage.provider,
      model: llmUsage.model,
      purpose: llmUsage.purpose,
      tokens: llmUsage.totalTokens,
      latencyMs: llmUsage.latencyMs,
      succeeded: llmUsage.succeeded,
      error: llmUsage.error,
      createdAt: llmUsage.createdAt,
    })
    .from(llmUsage)
    .leftJoin(organization, sql`${organization.id} = ${llmUsage.organizationId}`)
    .orderBy(desc(llmUsage.createdAt))
    .limit(200);

  const perProvider = new Map<string, { calls: number; tokens: number; latency: number[] }>();
  let ok = 0;
  let fail = 0;
  for (const r of last200) {
    const k = r.provider;
    const bucket =
      perProvider.get(k) ?? { calls: 0, tokens: 0, latency: [] };
    bucket.calls += 1;
    bucket.tokens += r.tokens ?? 0;
    if (r.latencyMs != null) bucket.latency.push(r.latencyMs);
    perProvider.set(k, bucket);
    if (r.succeeded) ok += 1;
    else fail += 1;
  }
  const providerData = Array.from(perProvider.entries()).map(([provider, v]) => ({
    provider,
    calls: v.calls,
    tokens: v.tokens,
    p50:
      v.latency.length === 0
        ? 0
        : Math.round(
            v.latency.sort((a, b) => a - b)[Math.floor(v.latency.length / 2)] ?? 0,
          ),
  }));

  const totalTokens = Array.from(perProvider.values()).reduce(
    (a, v) => a + v.tokens,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LLM usage</h1>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          Last 200 calls across all tenants. Errors show which provider failed — that&apos;s
          the router cascade in action.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Calls", value: last200.length, icon: Zap },
          { label: "Tokens", value: totalTokens, icon: Cpu },
          { label: "Succeeded", value: ok, icon: CheckCircle2, tint: "text-emerald-500" },
          { label: "Failed", value: fail, icon: XCircle, tint: "text-rose-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] ${s.tint ?? "text-[rgb(var(--accent))]"}`}
              >
                <s.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                  {s.label}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {s.value.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Calls per provider</CardTitle>
            <CardDescription>
              Colored by provider. Higher bars = more volume.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            {providerData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-[rgb(var(--fg-subtle))]">
                No LLM calls yet. They appear here as soon as your bot replies.
              </p>
            ) : (
              <UsageProviderBar data={providerData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success vs failure</CardTitle>
            <CardDescription>Last 200 attempts.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-0">
            <UsageSuccessPie ok={ok} fail={fail} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent calls</CardTitle>
          <CardDescription>
            <code>llm_usage</code> is a regular Postgres table — query it directly for custom
            dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border))] text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                  <th className="px-2 py-2 text-left font-semibold">When</th>
                  <th className="px-2 py-2 text-left font-semibold">Org</th>
                  <th className="px-2 py-2 text-left font-semibold">Provider</th>
                  <th className="px-2 py-2 text-left font-semibold">Model</th>
                  <th className="px-2 py-2 text-left font-semibold">Purpose</th>
                  <th className="px-2 py-2 text-right font-semibold">Tokens</th>
                  <th className="px-2 py-2 text-right font-semibold">ms</th>
                  <th className="px-2 py-2 text-right font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {last200.slice(0, 50).map((r) => (
                  <tr key={r.id} className="text-xs">
                    <td className="px-2 py-2 text-[rgb(var(--fg-muted))] whitespace-nowrap">
                      {r.createdAt.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 truncate">{r.orgName ?? r.orgId}</td>
                    <td className="px-2 py-2 font-mono">{r.provider}</td>
                    <td className="px-2 py-2 font-mono">{r.model}</td>
                    <td className="px-2 py-2">{r.purpose}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.tokens}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.latencyMs ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {r.succeeded ? (
                        <Badge variant="success" className="text-[10px]">
                          ok
                        </Badge>
                      ) : (
                        <Badge
                          variant="danger"
                          className="text-[10px]"
                          title={r.error ?? ""}
                        >
                          fail
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
