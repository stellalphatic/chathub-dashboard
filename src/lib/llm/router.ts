import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { llmUsage, platformLlmCredential } from "@/db/schema";
import { decryptJSON } from "@/lib/encryption";
import { makeProvider, type ProviderCredential } from "./providers";
import type {
  LlmCompleteInput,
  LlmCompleteOutput,
  LlmProvider,
  LlmProviderName,
} from "./types";

/**
 * Router policy:
 *   1. Load enabled platform credentials ordered by priority (Groq lowest = first).
 *   2. Try each provider in order. On network / 5xx / timeout, fall through.
 *   3. Record every attempt in llm_usage for observability + cost.
 *
 * ENV fallback: if no platform_llm_credential rows exist yet, fall back to
 *   GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY. This lets you ship on day 1
 *   without seeding the DB.
 */

export type RouterCallCtx = {
  organizationId: string;
  conversationId?: string;
  purpose?: "reply" | "classify" | "summarize";
};

let _cachedProviders: LlmProvider[] | null = null;
let _cachedAt = 0;
const CACHE_MS = 30_000;

function decodeCredFromEnv(name: LlmProviderName): LlmProvider | null {
  switch (name) {
    case "groq": {
      const key = process.env.GROQ_API_KEY;
      if (!key) return null;
      return makeProvider({
        provider: "groq",
        apiKey: key,
        defaultModel: process.env.GROQ_MODEL,
      });
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
      if (!key) return null;
      return makeProvider({
        provider: "gemini",
        apiKey: key,
        defaultModel: process.env.GEMINI_MODEL,
      });
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return null;
      return makeProvider({
        provider: "openai",
        apiKey: key,
        defaultModel: process.env.OPENAI_MODEL,
      });
    }
  }
}

async function loadProviders(): Promise<LlmProvider[]> {
  if (_cachedProviders && Date.now() - _cachedAt < CACHE_MS) {
    return _cachedProviders;
  }

  const out: LlmProvider[] = [];

  // 1) DB credentials (admin UI). Priority ascending (Groq=10, Gemini=20, …)
  try {
    const rows = await db
      .select()
      .from(platformLlmCredential)
      .where(eq(platformLlmCredential.enabled, true))
      .orderBy(platformLlmCredential.priority);

    for (const row of rows) {
      if (!row.secretsCiphertext) continue;
      try {
        const decrypted = decryptJSON<{
          apiKey: string;
          baseUrl?: string;
        }>(row.secretsCiphertext);
        if (!decrypted.apiKey) continue;
        out.push(
          makeProvider({
            provider: row.provider as LlmProviderName,
            apiKey: decrypted.apiKey,
            defaultModel: row.defaultModel,
          } as ProviderCredential),
        );
      } catch (e) {
        console.error(`[llm-router] failed to decrypt ${row.provider}:`, e);
      }
    }
  } catch (e) {
    // Table might not exist yet on first deploy; fall through to env.
    console.warn("[llm-router] platform_llm_credential unavailable:", e);
  }

  // 2) Env fallback if DB yielded nothing.
  if (out.length === 0) {
    const chain: LlmProviderName[] = ["groq", "gemini", "openai"];
    for (const name of chain) {
      const p = decodeCredFromEnv(name);
      if (p) out.push(p);
    }
  }

  _cachedProviders = out;
  _cachedAt = Date.now();
  return out;
}

/** Invalidate after admin updates credentials. */
export function clearLlmProviderCache() {
  _cachedProviders = null;
  _cachedAt = 0;
}

/** Record a usage row; never throw from observability. */
async function recordUsage(
  ctx: RouterCallCtx,
  attempt: {
    provider: LlmProviderName;
    model: string;
    succeeded: boolean;
    error?: string;
    out?: LlmCompleteOutput;
  },
) {
  try {
    await db.insert(llmUsage).values({
      id: randomUUID(),
      organizationId: ctx.organizationId,
      conversationId: ctx.conversationId ?? null,
      provider: attempt.provider,
      model: attempt.model,
      purpose: ctx.purpose ?? "reply",
      promptTokens: attempt.out?.promptTokens ?? 0,
      completionTokens: attempt.out?.completionTokens ?? 0,
      totalTokens: attempt.out?.totalTokens ?? 0,
      latencyMs: attempt.out?.latencyMs ?? null,
      succeeded: attempt.succeeded,
      error: attempt.error ?? null,
    });
  } catch (e) {
    console.warn("[llm-router] usage log failed:", e);
  }
}

export class LlmRouterError extends Error {
  attempts: { provider: LlmProviderName; error: string }[];
  constructor(
    message: string,
    attempts: { provider: LlmProviderName; error: string }[],
  ) {
    super(message);
    this.attempts = attempts;
  }
}

export async function llmComplete(
  input: LlmCompleteInput,
  ctx: RouterCallCtx,
  opts?: { providerOrder?: LlmProviderName[] },
): Promise<LlmCompleteOutput> {
  const providers = await loadProviders();
  if (providers.length === 0) {
    throw new LlmRouterError(
      "No LLM provider is configured. Set GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY or add providers in the admin console.",
      [],
    );
  }

  // Optional per-bot ordering (e.g. ["openai","groq"])
  const order = opts?.providerOrder;
  const sorted = order
    ? [...providers].sort((a, b) => {
        const ia = order.indexOf(a.name);
        const ib = order.indexOf(b.name);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
    : providers;

  const errors: { provider: LlmProviderName; error: string }[] = [];
  for (const provider of sorted) {
    try {
      const out = await provider.complete(input);
      await recordUsage(ctx, {
        provider: provider.name,
        model: input.model ?? provider.defaultModel,
        succeeded: true,
        out,
      });
      return out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ provider: provider.name, error: msg });
      console.warn(`[llm-router] ${provider.name} failed:`, msg);
      await recordUsage(ctx, {
        provider: provider.name,
        model: input.model ?? provider.defaultModel,
        succeeded: false,
        error: msg,
      });
      // 4xx auth/quota errors should still cascade — this is a chat path,
      // not a billing path, so prefer availability over strict fidelity.
      continue;
    }
  }

  throw new LlmRouterError("All LLM providers failed", errors);
}

/** Most-recent usage row (diagnostics). */
export async function lastUsage(organizationId: string) {
  return db
    .select()
    .from(llmUsage)
    .where(and(eq(llmUsage.organizationId, organizationId)))
    .orderBy(desc(llmUsage.createdAt))
    .limit(10);
}
