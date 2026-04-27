import { sql } from "drizzle-orm";
import { db } from "@/db";
import { QUEUES, safeEnqueue, type EmbedDocumentJob } from "@/lib/queue";

/**
 * Pick up `pending` documents whose embed-document job never reached Redis
 * (e.g. Lambda → Redis was unreachable when the upload happened). Runs on
 * the worker's slow tick — once per minute is plenty for documents.
 *
 * Bounded:
 *   - Only documents created in the last 60 minutes (older = manual delete).
 *   - Marks `status='processing'` while the job runs so we don't re-enqueue.
 *   - The embed-document handler will move it to `indexed` / `failed`.
 */
export async function reconcilePendingDocuments(batchSize = 25): Promise<{
  found: number;
  enqueued: number;
}> {
  const rows = await db.execute<{
    id: string;
    organization_id: string;
  }>(sql`
    WITH due AS (
      SELECT id, organization_id
      FROM document
      WHERE status = 'pending'
        AND created_at >= NOW() - interval '60 minutes'
        AND created_at <= NOW() - interval '5 seconds'
      ORDER BY created_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE document
    SET status = 'processing', updated_at = NOW()
    FROM due
    WHERE document.id = due.id
    RETURNING document.id, document.organization_id;
  `);

  type Row = { id: string; organization_id: string };
  const list: Row[] = Array.isArray(rows)
    ? (rows as unknown as Row[])
    : ((rows as unknown as { rows?: Row[] }).rows ?? []);

  let enqueued = 0;
  for (const r of list) {
    const job: EmbedDocumentJob = {
      organizationId: r.organization_id,
      documentId: r.id,
    };
    const res = await safeEnqueue(QUEUES.embedDocument, job, {
      jobId: `doc:reconcile:${r.id}`,
    });
    if (res.ok) enqueued++;
  }

  if (list.length > 0) {
    console.log(
      `[reconcile] doc-orphans found=${list.length} enqueued=${enqueued}`,
    );
  }

  return { found: list.length, enqueued };
}
