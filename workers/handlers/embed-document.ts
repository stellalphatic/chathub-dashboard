import type { Job } from "bullmq";
import type { EmbedDocumentJob } from "../../src/lib/queue";
import { ingestDocument } from "../../src/lib/services/rag-ingest";

export async function handleEmbedDocument(job: Job<EmbedDocumentJob>) {
  return ingestDocument({
    organizationId: job.data.organizationId,
    documentId: job.data.documentId,
  });
}
