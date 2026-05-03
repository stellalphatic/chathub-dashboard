import { desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db";
import { template } from "@/db/schema";
import { assertOrgPage } from "@/lib/org-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { TemplateRowActions } from "@/components/templates/template-row-actions";

function statusVariant(
  status: string,
): "success" | "warning" | "danger" | "secondary" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "pending") return "warning";
  return "secondary";
}

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await assertOrgPage(orgSlug, "templates", "view");
  const { org } = access;
  const readOnly = !access.permissions.templates.edit;

  const rows = await db
    .select()
    .from(template)
    .where(eq(template.organizationId, org.id))
    .orderBy(desc(template.updatedAt));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[rgb(var(--fg))]">
          Templates
        </h2>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          WhatsApp requires approved templates outside of Meta&apos;s 24-hour customer-service
          window. Create here, submit to Meta/YCloud for approval, mark as approved when it
          clears.
        </p>
        {readOnly ? (
          <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            View-only: you can read template definitions; status changes and creates require editor
            access or higher.
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create or update a template</CardTitle>
          <CardDescription>
            Use <code className="text-[rgb(var(--accent))]">{`{{1}}`}</code>,{" "}
            <code className="text-[rgb(var(--accent))]">{`{{2}}`}</code>, … in the body for
            per-send substitutions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            <p className="text-sm text-[rgb(var(--fg-muted))]">Creates and updates are disabled for your role.</p>
          ) : (
            <CreateTemplateForm orgSlug={orgSlug} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
          Templates ({rows.length})
        </h3>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-[rgb(var(--fg-subtle))]" />
              <p className="mt-3 text-sm font-medium">No templates yet</p>
              <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
                Create one above — remember to submit the same name to Meta/YCloud for approval.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((t) => (
              <Card key={t.id} className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-mono text-sm">{t.name}</CardTitle>
                    <span className="text-xs text-[rgb(var(--fg-subtle))]">·</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.language}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.category}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.channel}
                    </Badge>
                    <Badge
                      variant={statusVariant(t.status)}
                      className="ml-auto text-[10px]"
                    >
                      {t.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 font-mono text-xs text-[rgb(var(--fg))]">
                    {t.bodyPreview}
                  </div>
                  <TemplateRowActions
                    orgSlug={orgSlug}
                    id={t.id}
                    status={t.status}
                    readOnly={readOnly}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
