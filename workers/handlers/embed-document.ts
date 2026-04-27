import type { Job } from "bullmq";
import type { EmbedDocumentJob } from "../../src/lib/queue";
import { ingestDocument } from "../../src/lib/services/rag-ingest";

export async function handleEmbedDocument(job: Job<EmbedDocumentJob>) {
  // Cap retries — most embed failures are deterministic (no API key, file
  // unreadable). Fail fast so the row turns `failed` and the operator sees it.
  if ((job.attemptsMade ?? 0) >= 1) {
    job.opts.attempts = (job.attemptsMade ?? 0) + 1;
  }
  return ingestDocument({
    organizationId: job.data.organizationId,
    documentId: job.data.documentId,
  });
}
