import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit uses prepared statements during `db:push` introspection. Those
 * are NOT supported by Supabase's transaction pooler (port 6543), which is
 * what most apps set as DATABASE_URL. drizzle-kit will hang on
 * "Pulling schema from database…" if you point it there.
 *
 * Set DRIZZLE_DATABASE_URL to the **session pooler** URL (port 5432) — copy
 * it from Supabase → Project Settings → Database → Connection string →
 * "Session pooler". This config falls back to DATABASE_URL only if the
 * dedicated one isn't set.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DRIZZLE_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://localhost:5432/chathub",
  },
});
