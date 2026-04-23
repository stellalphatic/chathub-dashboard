import IORedis, { type Redis, type RedisOptions } from "ioredis";

/**
 * Singleton Redis connection for the Next.js runtime.
 * BullMQ uses its own connections (see lib/queue.ts) configured with
 * maxRetriesPerRequest=null as BullMQ requires.
 */

let _redis: Redis | null = null;

function buildOptions(): RedisOptions {
  return {
    // TLS only if the URL says so; for self-hosted we stay plaintext on VPC.
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    lazyConnect: false,
  };
}

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is required. Set to redis://host:port or rediss:// for TLS.",
    );
  }
  _redis = new IORedis(url, buildOptions());
  _redis.on("error", (err) => {
    console.error("[redis] error:", err.message);
  });
  return _redis;
}

/** For BullMQ — must have maxRetriesPerRequest=null */
export function buildBullConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is required for BullMQ. Set to redis://host:port.",
    );
  }
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function redisPing(): Promise<boolean> {
  try {
    const r = getRedis();
    const pong = await r.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
