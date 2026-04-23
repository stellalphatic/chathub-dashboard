import { desc, eq } from "drizzle-orm";
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
import { AddDocumentForm } from "@/components/knowledge/add-document-form";
import { DocumentActions } from "@/components/knowledge/document-actions";

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Knowledge base</h2>
        <p className="text-sm text-zinc-400">
          Upload FAQs, policies, product docs. Text is chunked, embedded, and
          stored in your vector DB. The bot only retrieves from your
          documents — no cross-tenant leaks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add knowledge</CardTitle>
          <CardDescription>
            Paste text now; file uploads (PDF/DOCX) use the{" "}
            <code className="text-emerald-400">POST /api/v1/documents</code>{" "}
            endpoint — see docs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddDocumentForm orgSlug={orgSlug} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {docs.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
            No documents yet.
          </p>
        ) : (
          docs.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="truncate">{d.title}</span>
                  <DocumentActions orgSlug={orgSlug} id={d.id} />
                </CardTitle>
                <CardDescription>
                  {d.source} · {d.mimeType ?? "unknown"} ·{" "}
                  <span
                    className={
                      d.status === "indexed"
                        ? "text-emerald-400"
                        : d.status === "failed"
                          ? "text-red-400"
                          : "text-amber-400"
                    }
                  >
                    {d.status}
                  </span>{" "}
                  · {d.chunkCount} chunks
                  {d.failureReason && (
                    <>
                      <br />
                      <span className="text-red-300">{d.failureReason}</span>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
