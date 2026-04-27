import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { isS3Configured, uploadToS3 } from "@/lib/media/s3";
import { getServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/s3-check
 *
 * Platform-admin-only diagnostic. Tries to upload a tiny "ping" object to
 * the configured bucket so you can verify IAM permissions + bucket region
 * + connectivity in one click. Cleans up after itself? Not yet — the
 * dummy object lives at <orgId>/_health/ping-<ts>.txt and is harmless.
 */
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

  if (!isS3Configured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      hint: "S3_BUCKET / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not all set. Check Amplify env.",
    });
  }

  const bucket = process.env.S3_BUCKET ?? "";
  const region = process.env.S3_REGION ?? "us-east-1";
  const ts = new Date().toISOString();
  const body = Buffer.from(
    `chathub-s3-check\nuser=${session.user.email}\nat=${ts}\n`,
    "utf8",
  );

  try {
    const res = await uploadToS3({
      organizationId: "_health",
      documentId: `ping-${Date.now()}`,
      fileName: "ping.txt",
      mimeType: "text/plain",
      body,
    });
    return NextResponse.json({
      ok: true,
      configured: true,
      bucket,
      region,
      key: res.key,
      url: res.publicUrl,
      hint: "S3 PutObject succeeded. Knowledge uploads should work.",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const code =
      (e as { Code?: string; name?: string }).Code ??
      (e as { Code?: string; name?: string }).name ??
      "Unknown";
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        bucket,
        region,
        code,
        error: raw.slice(0, 500),
        hint: explain(code, raw),
      },
      { status: 502 },
    );
  }
}

function explain(code: string, raw: string): string {
  if (/AccessDenied|403/i.test(code) || /AccessDenied|403/i.test(raw)) {
    return "Bucket denies your IAM user. Attach this minimum policy to the user: { Effect:Allow, Action:[s3:PutObject, s3:GetObject, s3:DeleteObject], Resource:'arn:aws:s3:::<bucket>/*' } AND { Effect:Allow, Action:[s3:ListBucket], Resource:'arn:aws:s3:::<bucket>' }.";
  }
  if (/NoSuchBucket/i.test(code) || /NoSuchBucket/i.test(raw)) {
    return "Bucket name doesn't exist in this region. Check S3_BUCKET typo and that it lives in S3_REGION.";
  }
  if (/PermanentRedirect/i.test(raw) || /301|307/i.test(code)) {
    return "Region mismatch. The bucket lives elsewhere — change S3_REGION to the bucket's actual region.";
  }
  if (/InvalidAccessKeyId|SignatureDoesNotMatch/i.test(raw)) {
    return "Access key invalid. Check Amplify env values for stray quotes / newlines.";
  }
  return raw.slice(0, 200);
}
