import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { botConfig as botConfigTable, botFaq } from "@/db/schema";
import { getRedis } from "@/lib/redis";

/**
 * Hot-path cache for bot persona + system prompt + FAQs.
 *
 * - Shared across workers + web via Redis (so every process sees the same cache).
 * - Short TTL keeps drift tiny; admins also call `invalidateBotConfigCache()`
 *   when persona / FAQs change.
 */
export type CachedBotConfig = {
  bot: typeof botConfigTable.$inferSelect | null;
  faqs: (typeof botFaq.$inferSelect)[];
};

const TTL_SECONDS = 60;
const PREFIX = "bot-cfg:v1:";

function key(orgId: string): string {
  return `${PREFIX}${orgId}`;
}

export async function invalidateBotConfigCache(orgId: string): Promise<void> {
  try {
    await getRedis().del(key(orgId));
  } catch (e) {
    console.warn("[bot-cache] invalidate failed:", e);
  }
}

export async function getCachedBotConfig(orgId: string): Promise<CachedBotConfig> {
  let redis: ReturnType<typeof getRedis> | null = null;
  try {
    redis = getRedis();
  } catch {
    // Redis not configured; fall back to DB every time.
  }

  if (redis) {
    try {
      const raw = await redis.get(key(orgId));
      if (raw) {
        const parsed = JSON.parse(raw) as CachedBotConfig;
        return parsed;
      }
    } catch (e) {
      console.warn("[bot-cache] get failed:", e);
    }
  }

  const [bot] = await db
    .select()
    .from(botConfigTable)
    .where(eq(botConfigTable.organizationId, orgId))
    .limit(1);

  const faqs = await db
    .select()
    .from(botFaq)
    .where(and(eq(botFaq.organizationId, orgId), eq(botFaq.enabled, true)));

  const payload: CachedBotConfig = { bot: bot ?? null, faqs };

  if (redis) {
    try {
      await redis.set(key(orgId), JSON.stringify(payload), "EX", TTL_SECONDS);
    } catch (e) {
      console.warn("[bot-cache] set failed:", e);
    }
  }
  return payload;
}
