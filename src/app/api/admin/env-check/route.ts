import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/env-check
 *
 * Platform-admin-only diagnostic. Returns which server-side env vars are
 * actually visible at *runtime* (Amplify Lambda) — never the values, only
 * presence + length. Useful when env vars are set in the console but the
 * Lambda doesn't seem to receive them.
 */
const VARS_TO_CHECK = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "ENCRYPTION_KEY",
  "ENCRYPTION_KEY_PREVIOUS",
  "REDIS_URL",
  "QDRANT_URL",
  "QDRANT_API_KEY",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "META_APP_SECRET",
  "META_VERIFY_TOKEN",
  "YCLOUD_WEBHOOK_SECRET",
  "MANYCHAT_WEBHOOK_SECRET",
  "CHATHUB_PLATFORM_ADMIN_EMAILS",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
] as const;

/**
 * Static reads only — bracket-access (`process.env[name]`) cannot be
 * inlined by Next.js at build time, so on Amplify it would mask the real
 * problem. This switch ensures the diagnostic reflects what your action
 * code actually sees.
 */
function readByName(name: string): string | undefined {
  switch (name) {
    case "DATABASE_URL":
      return process.env.DATABASE_URL;
    case "CLERK_SECRET_KEY":
      return process.env.CLERK_SECRET_KEY;
    case "ENCRYPTION_KEY":
      return process.env.ENCRYPTION_KEY;
    case "ENCRYPTION_KEY_PREVIOUS":
      return process.env.ENCRYPTION_KEY_PREVIOUS;
    case "REDIS_URL":
      return process.env.REDIS_URL;
    case "QDRANT_URL":
      return process.env.QDRANT_URL;
    case "QDRANT_API_KEY":
      return process.env.QDRANT_API_KEY;
    case "S3_REGION":
      return process.env.S3_REGION;
    case "S3_BUCKET":
      return process.env.S3_BUCKET;
    case "S3_ACCESS_KEY_ID":
      return process.env.S3_ACCESS_KEY_ID;
    case "S3_SECRET_ACCESS_KEY":
      return process.env.S3_SECRET_ACCESS_KEY;
    case "META_APP_SECRET":
      return process.env.META_APP_SECRET;
    case "META_VERIFY_TOKEN":
      return process.env.META_VERIFY_TOKEN;
    case "YCLOUD_WEBHOOK_SECRET":
      return process.env.YCLOUD_WEBHOOK_SECRET;
    case "MANYCHAT_WEBHOOK_SECRET":
      return process.env.MANYCHAT_WEBHOOK_SECRET;
    case "CHATHUB_PLATFORM_ADMIN_EMAILS":
      return process.env.CHATHUB_PLATFORM_ADMIN_EMAILS;
    case "NEXT_PUBLIC_APP_URL":
      return process.env.NEXT_PUBLIC_APP_URL;
    case "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY":
      return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    default:
      return undefined;
  }
}

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [u] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!u?.platformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = VARS_TO_CHECK.map((name) => {
    const v = readByName(name);
    return {
      name,
      set: typeof v === "string" && v.length > 0,
      length: typeof v === "string" ? v.length : 0,
    };
  });

  // ENCRYPTION_KEY: validate it actually decodes to 32 bytes too — a value
  // wrapped in quotes or with a stray newline will pass the "set" check
  // but fail the runtime decode.
  const encKey = readByName("ENCRYPTION_KEY");
  let encryptionStatus: "ok" | "missing" | "invalid_length" = "missing";
  if (encKey) {
    try {
      const trimmed = encKey.trim();
      const buf = /^[0-9a-f]+$/i.test(trimmed) && trimmed.length === 64
        ? Buffer.from(trimmed, "hex")
        : Buffer.from(trimmed, "base64");
      encryptionStatus = buf.length === 32 ? "ok" : "invalid_length";
    } catch {
      encryptionStatus = "invalid_length";
    }
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    encryptionStatus,
    vars: result,
  });
}
