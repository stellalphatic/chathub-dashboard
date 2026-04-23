import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { template } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { TemplateRowActions } from "@/components/templates/template-row-actions";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const rows = await db
    .select()
    .from(template)
    .where(eq(template.organizationId, org.id))
    .orderBy(desc(template.updatedAt));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Message templates</h2>
        <p className="text-sm text-zinc-400">
          Templates are required by WhatsApp when the 24-hour customer service
          window is closed. Create here, submit to Meta/YCloud for approval,
          then mark approved.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create / update template</CardTitle>
          <CardDescription>
            Use <code className="text-emerald-400">{`{{1}} {{2}}`}</code>{" "}
            placeholders in the body.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTemplateForm orgSlug={orgSlug} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
            No templates yet.
          </p>
        ) : (
          rows.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="truncate font-mono">
                    {t.name} <span className="text-zinc-500">· {t.language}</span>
                  </span>
                  <span
                    className={
                      t.status === "approved"
                        ? "rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                        : t.status === "rejected"
                          ? "rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300"
                          : "rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"
                    }
                  >
                    {t.status}
                  </span>
                </CardTitle>
                <CardDescription>
                  {t.category} · {t.channel}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
                  {t.bodyPreview}
                </p>
                <TemplateRowActions orgSlug={orgSlug} id={t.id} status={t.status} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
