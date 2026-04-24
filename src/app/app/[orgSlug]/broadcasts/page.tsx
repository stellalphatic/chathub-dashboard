import { desc, eq } from "drizzle-orm";
import { Megaphone } from "lucide-react";
import { db } from "@/db";
import { broadcast, template } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateBroadcastForm } from "@/components/broadcasts/create-broadcast-form";

function statusVariant(
  status: string,
): "success" | "warning" | "danger" | "secondary" | "gradient" {
  if (status === "completed") return "success";
  if (status === "running") return "gradient";
  if (status === "failed") return "danger";
  if (status === "scheduled") return "warning";
  return "secondary";
}

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
        <h2 className="text-xl font-semibold tracking-tight text-[rgb(var(--fg))]">
          Broadcasts
        </h2>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          Send an approved WhatsApp template to a list of contacts. Each send respects the
          24-hour customer-service window and is rate-limited at the provider level.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total broadcasts", value: rows.length },
          {
            label: "Completed",
            value: rows.filter((r) => r.status === "completed").length,
          },
          {
            label: "Approved templates",
            value: approved.length,
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                {k.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New broadcast</CardTitle>
          <CardDescription>
            Pick an approved template, set default variable values, target by tag or status.
            The worker expands the audience and dispatches with rate limiting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              No approved templates yet. Create one on the{" "}
              <a
                href={`/app/${orgSlug}/templates`}
                className="underline hover:text-amber-500"
              >
                Templates
              </a>{" "}
              tab and mark it as approved first.
            </p>
          ) : (
            <CreateBroadcastForm
              orgSlug={orgSlug}
              approvedTemplates={approved.map((t) => ({
                id: t.id,
                name: t.name,
                language: t.language,
                variables: (t.variables ?? []) as string[],
              }))}
            />
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
          Recent broadcasts ({rows.length})
        </h3>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-[rgb(var(--fg-subtle))]" />
              <p className="mt-3 text-sm font-medium">No broadcasts yet</p>
              <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
                Your first outbound campaign will appear here with per-recipient deliverability.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <Card key={r.id} className="card-hover">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">
                      {r.name || "Untitled broadcast"}
                    </CardTitle>
                    <Badge variant={statusVariant(r.status)} className="text-[10px]">
                      {r.status}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-[11px]">
                    {r.channel} · {new Date(r.createdAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Sent", value: r.sentCount, color: "text-emerald-500" },
                    { label: "Failed", value: r.failedCount, color: "text-rose-500" },
                    { label: "Skipped", value: r.skippedCount, color: "text-amber-500" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3"
                    >
                      <p className={`text-xl font-semibold tabular-nums ${s.color}`}>
                        {s.value ?? 0}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
