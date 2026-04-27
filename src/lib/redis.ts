import IORedis, { type Redis, type RedisOptions } from "ioredis";

/**
 * Singleton Redis connection for the Next.js runtime.
 * BullMQ uses its own connections (see lib/queue.ts) configured with
 * maxRetriesPerRequest=null as BullMQ requires.
 */

let _redis: Redis | null = null;

/**
 * Recover from common ways `REDIS_URL` arrives malformed in CloudWatch:
 *   - Surrounded by quotes (Amplify console occasionally adds them)
 *   - Missing the `redis://` scheme  (we saw `//:pass@host:port` in logs)
 *   - Trailing newline / whitespace
 *
 * Without the scheme ioredis falls back to "this is a Unix socket path"
 * and throws `connect ENOENT //:pass@host:port`.
 */
export function normalizeRedisUrl(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("redis://") || s.startsWith("rediss://") || s.startsWith("unix:")) {
    return s;
  }
  if (s.startsWith("//")) {
    return "redis:" + s; // // → redis://
  }
  if (/^[\w.-]+:\d+$/.test(s)) {
    return `redis://${s}`; // host:port
  }
  // Last resort: attempt to prepend
  return `redis://${s}`;
}

/** Mask the password for safe log output: `redis://:****@host:port` */
function maskRedisUrl(url: string): string {
  return url.replace(/(\/\/[^:@/]*:)[^@]+(@)/, "$1****$2");
}

function readRedisUrl(label: string): string {
  const raw = process.env.REDIS_URL;
  if (!raw) {
    throw new Error(
      `REDIS_URL is required (${label}). Set to redis://[:password@]host:port (or rediss:// for TLS).`,
    );
  }
  const normalized = normalizeRedisUrl(raw);
  if (normalized !== raw.trim()) {
    console.warn(
      `[redis] REDIS_URL was repaired at runtime: raw=${maskRedisUrl(raw)} → ${maskRedisUrl(normalized)}`,
    );
  }
  return normalized;
}

function buildOptions(): RedisOptions {
  return {
    // TLS only if the URL says so; for self-hosted we stay plaintext on VPC.
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    lazyConnect: false,
    // Fail fast on TCP connect — much better than the default 10s
    // when the EC2 box is unreachable / SG-blocked.
    connectTimeout: 5000,
  };
}

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = readRedisUrl("getRedis");
  _redis = new IORedis(url, buildOptions());
  _redis.on("error", (err) => {
    console.error("[redis] error:", err.message);
  });
  return _redis;
}

/** For BullMQ — must have maxRetriesPerRequest=null */
export function buildBullConnection() {
  const url = readRedisUrl("buildBullConnection");
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 5000,
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
