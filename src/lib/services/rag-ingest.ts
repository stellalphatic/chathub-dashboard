import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, documentChunk } from "@/db/schema";
import { chunkText } from "@/lib/rag/chunker";
import { embed } from "@/lib/rag/embedder";
import { parseFileToText } from "@/lib/rag/parse";
import { getVectorStore } from "@/lib/rag/vector-store";

/**
 * Download the file, parse → chunk → embed → upsert into the vector store,
 * persist chunk text rows in Postgres, and mark the document as `indexed`.
 */
export async function ingestDocument(opts: {
  organizationId: string;
  documentId: string;
}) {
  const [doc] = await db
    .select()
    .from(document)
    .where(eq(document.id, opts.documentId))
    .limit(1);
  if (!doc) throw new Error("document not found");
  if (doc.organizationId !== opts.organizationId) {
    throw new Error("org mismatch");
  }
  if (!doc.fileUrl) {
    await markFailed(doc.id, "missing fileUrl");
    return;
  }

  await db
    .update(document)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(document.id, doc.id));

  try {
    // 1. Download.
    const res = await fetch(doc.fileUrl);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    // 2. Parse.
    const raw = await parseFileToText({
      buffer: buf,
      mimeType: doc.mimeType ?? "text/plain",
      filename: doc.title,
    });
    if (!raw.trim()) {
      throw new Error(
        "parsed text is empty — the file has no extractable text. If this is a PDF, it may be a scanned image (needs OCR outside ChatHub) or a protected/encoded PDF; try exporting a searchable PDF or paste plain text.",
      );
    }

    // 3. Chunk.
    const chunks = chunkText(raw);
    if (chunks.length === 0) throw new Error("no chunks produced");

    // 4. Embed in batches of 64.
    const store = getVectorStore(
      (doc.vectorStore as "qdrant" | "pinecone") ?? "qdrant",
    );
    const BATCH = 64;
    let dim = 0;
    const allChunkRows: (typeof documentChunk.$inferInsert)[] = [];
    const allVectors: { id: string; vector: number[]; payload: Record<string, unknown> }[] =
      [];

    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const e = await embed(slice.map((c) => c.content));
      if (!dim) dim = e.dim;
      slice.forEach((c, j) => {
        const id = randomUUID();
        allChunkRows.push({
          id,
          organizationId: doc.organizationId,
          documentId: doc.id,
          ord: c.ord,
          content: c.content,
          tokens: c.tokens,
        });
        allVectors.push({
          id,
          vector: e.vectors[j],
          payload: {
            documentId: doc.id,
            organizationId: doc.organizationId,
            title: doc.title,
            ord: c.ord,
            content: c.content,
          },
        });
      });
    }

    // 5. Ensure collection/namespace exists.
    await store.ensureNamespace(doc.organizationId, dim);

    // 6. Insert chunk text rows (5000 per insert, postgres limit safe).
    for (let i = 0; i < allChunkRows.length; i += 500) {
      await db.insert(documentChunk).values(allChunkRows.slice(i, i + 500));
    }

    // 7. Upsert vectors.
    for (let i = 0; i < allVectors.length; i += 256) {
      await store.upsert(doc.organizationId, allVectors.slice(i, i + 256));
    }

    await db
      .update(document)
      .set({
        status: "indexed",
        chunkCount: chunks.length,
        updatedAt: new Date(),
      })
      .where(eq(document.id, doc.id));
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await markFailed(doc.id, err);
    throw e;
  }
}

async function markFailed(documentId: string, err: string) {
  await db
    .update(document)
    .set({
      status: "failed",
      failureReason: err.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(document.id, documentId));
}

/** Also delete vector rows when a doc row is deleted. */
export async function purgeDocument(opts: {
  organizationId: string;
  documentId: string;
}) {
  const [doc] = await db
    .select()
    .from(document)
    .where(eq(document.id, opts.documentId))
    .limit(1);
  if (!doc) return;
  const store = getVectorStore(
    (doc.vectorStore as "qdrant" | "pinecone") ?? "qdrant",
  );
  try {
    await store.deleteByDocument(doc.organizationId, doc.id);
  } catch (e) {
    console.warn("[rag] vector delete failed (continuing):", e);
  }
  await db.delete(documentChunk).where(eq(documentChunk.documentId, doc.id));
  await db.delete(document).where(eq(document.id, doc.id));
}
