"use server";

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { platformLlmCredential, user as userTable } from "@/db/schema";
import { encryptJSON } from "@/lib/encryption";
import { clearLlmProviderCache } from "@/lib/llm/router";
import { getServerSession } from "@/lib/session";

async function requirePlatformAdmin() {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const [row] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!row?.platformAdmin) throw new Error("Forbidden");
  return session;
}

const upsertSchema = z.object({
  provider: z.enum(["groq", "gemini", "openai"]),
  enabled: z.boolean(),
  defaultModel: z.string().min(1),
  apiKey: z.string().min(10),
  priority: z.number().int().min(1).max(1000).default(100),
});

export async function upsertLlmCredentialAction(
  raw: z.infer<typeof upsertSchema>,
): Promise<{ ok: true } | { error: string }> {
  const p = upsertSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues.map((i) => i.message).join(", ") };
  await requirePlatformAdmin();

  const [existing] = await db
    .select({ id: platformLlmCredential.id })
    .from(platformLlmCredential)
    .where(eq(platformLlmCredential.provider, p.data.provider))
    .limit(1);

  const secretsCiphertext = encryptJSON({ apiKey: p.data.apiKey });
  if (existing) {
    await db
      .update(platformLlmCredential)
      .set({
        enabled: p.data.enabled,
        defaultModel: p.data.defaultModel,
        secretsCiphertext,
        priority: p.data.priority,
        updatedAt: new Date(),
      })
      .where(eq(platformLlmCredential.id, existing.id));
  } else {
    await db.insert(platformLlmCredential).values({
      id: randomUUID(),
      provider: p.data.provider,
      enabled: p.data.enabled,
      defaultModel: p.data.defaultModel,
      secretsCiphertext,
      priority: p.data.priority,
    });
  }
  clearLlmProviderCache();
  revalidatePath("/admin/llm");
  return { ok: true };
}

export async function toggleLlmCredentialAction(input: {
  provider: "groq" | "gemini" | "openai";
  enabled: boolean;
}): Promise<{ ok: true } | { error: string }> {
  await requirePlatformAdmin();
  await db
    .update(platformLlmCredential)
    .set({ enabled: input.enabled, updatedAt: new Date() })
    .where(eq(platformLlmCredential.provider, input.provider));
  clearLlmProviderCache();
  revalidatePath("/admin/llm");
  return { ok: true };
}

export async function deleteLlmCredentialAction(input: {
  provider: "groq" | "gemini" | "openai";
}): Promise<{ ok: true } | { error: string }> {
  await requirePlatformAdmin();
  await db
    .delete(platformLlmCredential)
    .where(eq(platformLlmCredential.provider, input.provider));
  clearLlmProviderCache();
  revalidatePath("/admin/llm");
  return { ok: true };
}

/**
 * Run a tiny test call through the router, preferring this provider. Returns
 * latency + tokens + snippet so the admin can verify a key without digging
 * into logs. Doesn't change any data.
 */
export async function testLlmCredentialAction(input: {
  provider: "groq" | "gemini" | "openai";
}): Promise<
  | {
      ok: true;
      latencyMs: number;
      tokens: number;
      snippet: string;
      model: string;
    }
  | { error: string }
> {
  await requirePlatformAdmin();
  // Force freshest credentials.
  clearLlmProviderCache();

  // Lazy-load the router so this action doesn't pull router deps elsewhere.
  const { llmComplete, LlmRouterError } = await import("@/lib/llm/router");

  try {
    const out = await llmComplete(
      {
        messages: [
          {
            role: "system",
            content:
              "You are a diagnostic. Reply with a single short sentence confirming you're online.",
          },
          { role: "user", content: "Are you reachable?" },
        ],
        maxOutputTokens: 40,
        temperature: 0,
      },
      {
        organizationId: "_admin_test_",
        purpose: "classify",
      },
      { providerOrder: [input.provider] },
    );
    return {
      ok: true,
      latencyMs: out.latencyMs ?? 0,
      tokens: out.totalTokens ?? 0,
      snippet: (out.text ?? "").slice(0, 160),
      model: out.model ?? "",
    };
  } catch (e) {
    if (e instanceof LlmRouterError) {
      const first = e.attempts[0];
      return { error: first?.error ?? e.message };
    }
    return {
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
