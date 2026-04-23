import { embed } from "./embedder";
import { getVectorStore } from "./vector-store";

export type RagCitation = {
  documentId: string;
  chunkId: string;
  score: number;
  content: string;
  title?: string;
};

export type RagContext = {
  citations: RagCitation[];
  /** Ready-to-paste block for the system prompt. */
  block: string;
};

/**
 * Retrieve ~k chunks for the given user query, filtered to this org only.
 * Returns both a structured list (for UI) and a formatted "context" block.
 */
export async function retrieveContext(opts: {
  organizationId: string;
  query: string;
  vectorStoreKind: "qdrant" | "pinecone";
  topK?: number;
  scoreFloor?: number;
}): Promise<RagContext> {
  const topK = opts.topK ?? 5;
  const store = getVectorStore(opts.vectorStoreKind);

  let vector: number[];
  try {
    const e = await embed(opts.query);
    vector = e.vectors[0];
  } catch (e) {
    console.warn("[rag] embed failed, skipping retrieval:", e);
    return { citations: [], block: "" };
  }
  if (!vector || vector.length === 0) {
    return { citations: [], block: "" };
  }

  let hits: Awaited<ReturnType<typeof store.query>> = [];
  try {
    hits = await store.query(opts.organizationId, vector, topK);
  } catch (e) {
    console.warn("[rag] vector query failed:", e);
    return { citations: [], block: "" };
  }

  const floor = opts.scoreFloor ?? 0.62;
  const filtered = hits.filter((h) => h.score >= floor);
  if (filtered.length === 0) {
    return { citations: [], block: "" };
  }

  const citations: RagCitation[] = filtered.map((h) => ({
    documentId: String(h.payload.documentId ?? ""),
    chunkId: h.id,
    score: h.score,
    content: String(h.payload.content ?? ""),
    title: h.payload.title ? String(h.payload.title) : undefined,
  }));

  const block = [
    "You have the following private knowledge from this business. Use it to answer but do not quote it verbatim unless it's a policy or price. Cite nothing.",
    ...citations.map(
      (c, i) =>
        `--- excerpt ${i + 1}${c.title ? ` (${c.title})` : ""} ---\n${c.content}`,
    ),
  ].join("\n\n");

  return { citations, block };
}
