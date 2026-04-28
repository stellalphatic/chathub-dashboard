import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { message, organizationMember, user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/media/<messageId>
 *
 * Stable, auth-protected URL for any media attached to a message
 * (voice notes, images, documents). The actual file lives on S3 with
 * Block Public Access enabled — direct S3 URLs are short-lived signed
 * URLs that expire in 24 hours. This route re-signs on demand so old
 * conversations stay playable forever, and only authenticated members
 * (or platform admins) can stream the asset.
 *
 * Resolution:
 *   1. Auth the requester (Clerk session).
 *   2. Load the message + its conversation's organizationId.
 *   3. Verify the user is a member of that org (or a platform admin).
 *   4. If `mediaUrl` is already a non-S3 URL (e.g. provider CDN), 302 to it.
 *   5. If `mediaUrl` is an S3 URL, parse out (bucket, region, key), generate
 *      a fresh 1-hour signed URL, and 302 to it.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params;
  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      id: message.id,
      organizationId: message.organizationId,
      conversationId: message.conversationId,
      mediaUrl: message.mediaUrl,
      mediaMimeType: message.mediaMimeType,
    })
    .from(message)
    .where(eq(message.id, messageId))
    .limit(1);
  if (!row || !row.mediaUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Authorization: platform admin OR a direct member of the message's org.
  const [me] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  const isAdmin = Boolean(me?.platformAdmin);
  if (!isAdmin) {
    const [member] = await db
      .select({ id: organizationMember.id })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.userId, session.user.id),
          eq(organizationMember.organizationId, row.organizationId),
        ),
      )
      .limit(1);
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const url = row.mediaUrl;

  // Provider CDN / non-S3 URL — just bounce.
  const s3 = parseS3Url(url);
  if (!s3) {
    return NextResponse.redirect(url, 302);
  }

  // Re-sign for 1h.
  try {
    const { S3Client, GetObjectCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const accessKeyId =
      process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
    const client = new S3Client({
      region: s3.region,
      followRegionRedirects: true,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
    const fresh = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: s3.bucket, Key: s3.key }),
      { expiresIn: 60 * 60 },
    );
    return NextResponse.redirect(fresh, 302);
  } catch (e) {
    console.error("[media] re-sign failed:", e);
    // Fall back to the stored URL — better than 500.
    return NextResponse.redirect(url, 302);
  }
}

/**
 * Parse an S3 virtual-hosted-style URL into its parts.
 * Examples:
 *   https://my-bucket.s3.us-east-1.amazonaws.com/foo/bar.mp3?X-Amz-...
 *   https://my-bucket.s3.amazonaws.com/foo/bar.mp3
 */
function parseS3Url(
  raw: string,
): { bucket: string; region: string; key: string } | null {
  try {
    const u = new URL(raw);
    const m = u.host.match(/^([^.]+)\.s3(?:\.([^.]+))?\.amazonaws\.com$/);
    if (!m) return null;
    const bucket = m[1];
    const region = m[2] ?? "us-east-1";
    const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
    if (!bucket || !key) return null;
    return { bucket, region, key };
  } catch {
    return null;
  }
}
