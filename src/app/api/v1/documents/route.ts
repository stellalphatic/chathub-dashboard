import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { document, organization } from "@/db/schema";
import { isS3Configured, uploadToS3 } from "@/lib/media/s3";
import { getOrgAccess } from "@/lib/org-access";
import { QUEUES, safeEnqueue, type EmbedDocumentJob } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow large-ish bodies; Next 15 caps at 1mb by default for route handlers.
export const maxDuration = 60;

/**
 * POST /api/v1/documents?orgSlug=<slug>
 *   Content-Type: multipart/form-data
 *   fields: title, file
 *
 * Uploads a file to S3 (if configured) OR falls back to data: URL, then
 * enqueues the embed job. Returns the doc id.
 *
 * The actual S3 upload helper lives inline here to avoid adding another
 * file; switch to a presigned PUT flow if uploads exceed ~5MB.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const orgSlug = url.searchParams.get("orgSlug");
    if (!orgSlug) {
      return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
    }
    const access = await getOrgAccess(orgSlug);
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch (e) {
      console.warn("[documents] formData parse failed:", e);
      return NextResponse.json(
        { error: "Could not read upload — try again with a smaller file." },
        { status: 400 },
      );
    }
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Give the document a title." }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 25 MB)." },
        { status: 400 },
      );
    }

    const id = randomUUID();
    const buf = Buffer.from(await file.arrayBuffer());

    let fileUrl: string;
    if (isS3Configured()) {
      try {
        const res = await uploadToS3({
          organizationId: access.org.id,
          documentId: id,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          body: buf,
        });
        fileUrl = res.publicUrl;
      } catch (e) {
        console.error("[documents] S3 upload failed:", e);
        return NextResponse.json(
          {
            error:
              "Couldn't upload to storage. Check S3 credentials & bucket policy and try again.",
          },
          { status: 502 },
        );
      }
    } else {
      // Fallback — keeps ingestion working on day 1 before S3 is wired up.
      fileUrl = `data:${file.type || "application/octet-stream"};base64,${buf.toString("base64")}`;
    }

    // Verify org still exists (race with deletion)
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, access.org.id))
      .limit(1);
    if (!org) {
      return NextResponse.json({ error: "Organization missing." }, { status: 404 });
    }

    try {
      await db.insert(document).values({
        id,
        organizationId: access.org.id,
        title,
        source: "upload",
        mimeType: file.type || null,
        sizeBytes: buf.byteLength,
        fileUrl,
        status: "pending",
        createdByUserId: access.userId,
      });
    } catch (e) {
      console.error("[documents] DB insert failed:", e);
      return NextResponse.json(
        { error: "Couldn't save the document — please try again." },
        { status: 500 },
      );
    }

    // Best-effort enqueue: if Redis is down, the worker scans `status=pending`
    // docs on its next tick and the job still runs.
    const job: EmbedDocumentJob = {
      organizationId: access.org.id,
      documentId: id,
    };
    await safeEnqueue(QUEUES.embedDocument, job, { jobId: `doc:${id}` });

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[documents] unexpected error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgSlug = url.searchParams.get("orgSlug");
  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }
  const access = await getOrgAccess(orgSlug);
  if (!access) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(document)
    .where(and(eq(document.organizationId, access.org.id)))
    .limit(200);
  return NextResponse.json({ documents: rows });
}
