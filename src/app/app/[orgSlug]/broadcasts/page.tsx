import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { broadcast, template } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateBroadcastForm } from "@/components/broadcasts/create-broadcast-form";

export default async function BroadcastsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const templates = await db
    .select({
      id: template.id,
      name: template.name,
      language: template.language,
      status: template.status,
      variables: template.variables,
    })
    .from(template)
    .where(eq(template.organizationId, org.id));

  const approved = templates.filter((t) => t.status === "approved");

  const rows = await db
    .select()
    .from(broadcast)
    .where(eq(broadcast.organizationId, org.id))
    .orderBy(desc(broadcast.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Broadcasts</h2>
        <p className="text-sm text-zinc-400">
          Send an approved template to a list of contacts (WhatsApp only for
          Phase 1). Each send respects the 24-hour window & is rate-limited at
          the provider level.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New broadcast</CardTitle>
          <CardDescription>
            Audience filters: tags + contact status. More filters coming in
            Phase 2.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateBroadcastForm
            orgSlug={orgSlug}
            approvedTemplates={approved.map((t) => ({
              id: t.id,
              name: t.name,
              language: t.language,
              variables: (t.variables ?? []) as string[],
            }))}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
            No broadcasts yet.
          </p>
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="truncate">{r.name}</span>
                  <span
                    className={
                      r.status === "completed"
                        ? "rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                        : r.status === "running"
                          ? "rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300"
                          : "rounded bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-300"
                    }
                  >
                    {r.status}
                  </span>
                </CardTitle>
                <CardDescription>
                  {r.channel} · sent {r.sentCount} · failed {r.failedCount} ·
                  skipped {r.skippedCount}
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
