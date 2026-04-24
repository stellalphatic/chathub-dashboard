import { desc, eq } from "drizzle-orm";
import { CheckCircle2, Clock3, FileText, XCircle } from "lucide-react";
import { db } from "@/db";
import { document } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddDocumentForm } from "@/components/knowledge/add-document-form";
import { DocumentActions } from "@/components/knowledge/document-actions";

function statusVariant(status: string): "success" | "warning" | "danger" | "secondary" {
  if (status === "indexed") return "success";
  if (status === "failed") return "danger";
  if (status === "pending" || status === "processing") return "warning";
  return "secondary";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "indexed")
    return <CheckCircle2 className="h-3 w-3 shrink-0" />;
  if (status === "failed") return <XCircle className="h-3 w-3 shrink-0" />;
  return <Clock3 className="h-3 w-3 shrink-0" />;
}

function prettySize(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const docs = await db
    .select()
    .from(document)
    .where(eq(document.organizationId, org.id))
    .orderBy(desc(document.createdAt));

  const totalChunks = docs.reduce((acc, d) => acc + (d.chunkCount ?? 0), 0);
  const indexed = docs.filter((d) => d.status === "indexed").length;
  const failed = docs.filter((d) => d.status === "failed").length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[rgb(var(--fg))]">
          Knowledge base
        </h2>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          Upload PDFs, docs, and FAQs. Files are chunked, embedded, and stored in your vector DB.
          Only your bot can retrieve from them — no cross-tenant leaks.
        </p>
      </div>

      {/* Summary row */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Documents", value: docs.length },
          { label: "Indexed chunks", value: totalChunks },
          { label: "Failed", value: failed },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add knowledge</CardTitle>
          <CardDescription>
            Upload a file or paste text. Embedding happens in a background worker — large files
            take a minute or two.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddDocumentForm orgSlug={orgSlug} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
            Documents ({docs.length})
          </h3>
          <span className="text-xs text-[rgb(var(--fg-subtle))]">
            {indexed} indexed · {failed} failed
          </span>
        </div>

        {docs.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-[rgb(var(--fg-subtle))]" />
              <p className="mt-3 text-sm font-medium text-[rgb(var(--fg))]">
                No documents yet
              </p>
              <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
                Drop a file above to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {docs.map((d) => (
              <Card key={d.id} className="card-hover">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] text-[rgb(var(--accent))]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="mt-0.5 truncate text-xs text-[rgb(var(--fg-subtle))]">
                        {d.source} · {d.mimeType ?? "unknown"} · {prettySize(d.sizeBytes)} ·{" "}
                        {d.chunkCount ?? 0} chunks
                      </p>
                      {d.failureReason ? (
                        <p className="mt-1 text-xs text-rose-500">{d.failureReason}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={statusVariant(d.status)} className="gap-1">
                      <StatusIcon status={d.status} />
                      {d.status}
                    </Badge>
                    <DocumentActions orgSlug={orgSlug} id={d.id} title={d.title} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
