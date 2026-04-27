/**
 * Vector store abstraction over Qdrant (default, self-hosted) + Pinecone.
 *
 * Every business is ISOLATED by namespace/collection:
 *   - Qdrant: one collection per org (`org_<id>`), so deletes & purges are cheap.
 *   - Pinecone: one index shared across orgs, namespace = org id.
 *
 * The org's bot_config.vectorStore field picks which adapter is used.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { Pinecone } from "@pinecone-database/pinecone";

export type VectorRecord = {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
};

export type VectorSearchHit = {
  id: string;
  score: number;
  payload: Record<string, unknown>;
};

export interface VectorStore {
  ensureNamespace(organizationId: string, dim: number): Promise<void>;
  upsert(organizationId: string, records: VectorRecord[]): Promise<void>;
  query(
    organizationId: string,
    vector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchHit[]>;
  deleteByDocument(
    organizationId: string,
    documentId: string,
  ): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Qdrant
// ─────────────────────────────────────────────────────────────────────────────

class QdrantStore implements VectorStore {
  private client: QdrantClient;
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL ?? "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
      // Skip the client/server version check — the qdrant-js client is
      // newer than our self-hosted Qdrant 1.12 image, but the API surface
      // we use is forward/backward-compatible. The warning every call is
      // just log noise.
      checkCompatibility: false,
    });
  }

  private coll(orgId: string) {
    return `org_${orgId.replace(/-/g, "")}`;
  }

  async ensureNamespace(orgId: string, dim: number): Promise<void> {
    const name = this.coll(orgId);
    try {
      await this.client.getCollection(name);
    } catch {
      await this.client.createCollection(name, {
        vectors: { size: dim, distance: "Cosine" },
      });
    }
  }

  async upsert(orgId: string, records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.client.upsert(this.coll(orgId), {
      wait: true,
      points: records.map((r) => ({
        id: r.id,
        vector: r.vector,
        payload: r.payload,
      })),
    });
  }

  async query(
    orgId: string,
    vector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchHit[]> {
    const res = await this.client.search(this.coll(orgId), {
      vector,
      limit: topK,
      filter: filter
        ? {
            must: Object.entries(filter).map(([k, v]) => ({
              key: k,
              match: { value: v },
            })),
          }
        : undefined,
    });
    return res.map((hit) => ({
      id: String(hit.id),
      score: hit.score ?? 0,
      payload: (hit.payload ?? {}) as Record<string, unknown>,
    }));
  }

  async deleteByDocument(
    orgId: string,
    documentId: string,
  ): Promise<void> {
    await this.client.delete(this.coll(orgId), {
      wait: true,
      filter: {
        must: [{ key: "documentId", match: { value: documentId } }],
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pinecone
// ─────────────────────────────────────────────────────────────────────────────

class PineconeStore implements VectorStore {
  private client: Pinecone;
  private indexName: string;

  constructor() {
    const key = process.env.PINECONE_API_KEY;
    if (!key) throw new Error("PINECONE_API_KEY missing");
    this.client = new Pinecone({ apiKey: key });
    this.indexName = process.env.PINECONE_INDEX ?? "chathub";
  }

  private ns(orgId: string) {
    return `org_${orgId}`;
  }

  async ensureNamespace(_orgId: string, _dim: number): Promise<void> {
    // Assume the index is pre-created with the right dim to avoid races.
    // (Creating a serverless index takes 30+ seconds and is an admin op.)
  }

  async upsert(orgId: string, records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    const index = this.client.index(this.indexName).namespace(this.ns(orgId));
    await index.upsert(
      records.map((r) => ({
        id: r.id,
        values: r.vector,
        metadata: r.payload as Record<string, string | number | boolean>,
      })),
    );
  }

  async query(
    orgId: string,
    vector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchHit[]> {
    const index = this.client.index(this.indexName).namespace(this.ns(orgId));
    const res = await index.query({
      vector,
      topK,
      includeMetadata: true,
      filter: filter as Record<string, unknown> | undefined,
    });
    return (res.matches ?? []).map((m) => ({
      id: m.id,
      score: m.score ?? 0,
      payload: (m.metadata ?? {}) as Record<string, unknown>,
    }));
  }

  async deleteByDocument(orgId: string, documentId: string): Promise<void> {
    const index = this.client.index(this.indexName).namespace(this.ns(orgId));
    await index.deleteMany({ documentId });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function getVectorStore(kind: "qdrant" | "pinecone"): VectorStore {
  if (kind === "pinecone") return new PineconeStore();
  return new QdrantStore();
}
