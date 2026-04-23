import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { llmUsage, organization } from "@/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function UsagePage() {
  const last50 = await db
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
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">LLM usage</h1>
        <p className="text-sm text-zinc-400">
          Last 50 calls across all tenants. Errors show the provider that
          failed so you can see fallback in action.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent calls</CardTitle>
          <CardDescription>
            Pull the same data through <code>llm_usage</code> in SQL for
            dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-2">When</th>
                  <th>Org</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Purpose</th>
                  <th>Tokens</th>
                  <th>ms</th>
                  <th>OK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {last50.map((r) => (
                  <tr key={r.id} className="text-xs">
                    <td className="py-2 text-zinc-400">
                      {r.createdAt.toLocaleString()}
                    </td>
                    <td className="truncate text-zinc-300">{r.orgName ?? r.orgId}</td>
                    <td>{r.provider}</td>
                    <td className="font-mono">{r.model}</td>
                    <td>{r.purpose}</td>
                    <td>{r.tokens}</td>
                    <td>{r.latencyMs ?? "—"}</td>
                    <td>
                      {r.succeeded ? (
                        <span className="text-emerald-400">ok</span>
                      ) : (
                        <span className="text-red-400" title={r.error ?? ""}>fail</span>
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
