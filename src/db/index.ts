import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy DB client.
 *
 * We build the postgres connection on first use (not at module import) so
 * Next.js's build-time "Collecting page data" phase doesn't blow up when
 * DATABASE_URL is absent or mis-formatted. Any runtime access through the
 * exported `db` Proxy triggers the real initialization.
 */

type DrizzleInstance = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleInstance | null = null;

/**
 * Trim whitespace and strip surrounding quotes that users sometimes paste
 * when copying values into hosting provider dashboards (Amplify, Vercel,
 * etc.). `postgres` rejects such URLs with "Invalid URL".
 */
function normalizeDatabaseUrl(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function initDb(): DrizzleInstance {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is required. Set the Supabase pooler URL in Amplify and on the worker.",
    );
  }
  const url = normalizeDatabaseUrl(raw);
  // `prepare: false` keeps us compatible with Supabase's transaction pooler
  // (pgbouncer). postgres-js also enables this when the URL has ?pgbouncer=true,
  // but being explicit doesn't hurt.
  const client = postgres(url, { max: 10, prepare: false });
  return drizzle(client, { schema });
}

export function getDb(): DrizzleInstance {
  if (!_db) _db = initDb();
  return _db;
}

/**
 * Back-compat export so `import { db } from "@/db"` keeps working everywhere.
 * Any property access triggers lazy init — never touched at import time.
 */
export const db = new Proxy({} as DrizzleInstance, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
}) as DrizzleInstance;
