/**
 * Patch drizzle-kit so `db:push` / `db:pull` don't crash on Supabase
 * check constraints that return a NULL constraint_definition.
 *
 * Bug: https://github.com/drizzle-team/drizzle-orm/issues/2478 (and duplicates)
 *   node_modules/drizzle-kit/bin.cjs:17861
 *   TypeError: Cannot read properties of undefined (reading 'replace')
 *
 * We replace the offending line with a nullish-coalescing guard. Idempotent —
 * running it twice is a no-op.
 *
 * Wired to `postinstall` in package.json so fresh clones / CI / `npm ci` get
 * the same behaviour.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "..", "node_modules", "drizzle-kit", "bin.cjs");

if (!existsSync(target)) {
  // drizzle-kit isn't installed yet (e.g. devDep skipped in prod). Nothing to do.
  process.exit(0);
}

const SRC = `checkValue = checkValue.replace(/^CHECK\\s*\\(\\(/, "").replace(/\\)\\)\\s*$/, "");`;
const DST = `checkValue = (checkValue ?? "").replace(/^CHECK\\s*\\(\\(/, "").replace(/\\)\\)\\s*$/, "");`;

const original = readFileSync(target, "utf8");

if (original.includes(DST)) {
  // Already patched.
  process.exit(0);
}

if (!original.includes(SRC)) {
  console.warn(
    "[patch-drizzle-kit] Expected source line not found — drizzle-kit version may have changed. Skipping patch.",
  );
  process.exit(0);
}

const patched = original.replace(SRC, DST);
writeFileSync(target, patched, "utf8");
console.log("[patch-drizzle-kit] Patched drizzle-kit bin.cjs for NULL check_constraint.constraint_definition.");
