import { getRedis } from "./redis";

/**
 * Sliding-window counter in Redis. One key per (scope, identifier, window).
 * Fails open on Redis errors so a Redis outage doesn't take down the API —
 * log the error and the caller should apply their own fallback policy.
 */
export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const redis = getRedis();
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const redisKey = `rl:${key}:${bucket}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds + 5);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      reset: (bucket + 1) * windowSeconds,
    };
  } catch (e) {
    console.warn("[rate-limit] redis failed, failing open:", e);
    return { allowed: true, remaining: limit, reset: now + windowSeconds };
  }
}

/** Per-org LLM rate guard (in addition to tokens). */
export function orgLlmRateLimit(orgId: string) {
  return rateLimit({
    key: `llm:${orgId}`,
    limit: Number(process.env.LLM_RATE_PER_MIN ?? 120),
    windowSeconds: 60,
  });
}

/** Per-channel send rate guard (WhatsApp ~80 msg/s business number). */
export function channelSendRateLimit(channelConnId: string) {
  return rateLimit({
    key: `send:${channelConnId}`,
    limit: Number(process.env.CHANNEL_SEND_PER_SEC ?? 40),
    windowSeconds: 1,
  });
}
