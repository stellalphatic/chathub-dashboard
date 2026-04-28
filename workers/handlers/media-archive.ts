import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { message } from "../../src/db/schema";
import type { MediaArchiveJob } from "../../src/lib/queue";
import { isS3Configured, mirrorUrlToS3 } from "../../src/lib/media/s3";

/**
 * Download an inbound media URL (WhatsApp/Meta CDN — expires!) to our S3 bucket
 * and rewrite `message.mediaUrl` to the S3 https URL. Idempotent per message.
 */
export async function handleMediaArchive(job: Job<MediaArchiveJob>) {
  const p = job.data;

  if (!isS3Configured()) {
    return { skipped: true, reason: "s3_not_configured" };
  }

  const [row] = await db
    .select({
      id: message.id,
      mediaUrl: message.mediaUrl,
      mediaMimeType: message.mediaMimeType,
      organizationId: message.organizationId,
    })
    .from(message)
    .where(eq(message.id, p.messageId))
    .limit(1);
  if (!row) return { skipped: true, reason: "message_missing" };
  if (!row.mediaUrl) return { skipped: true, reason: "no_media_url" };

  // Already on S3? Skip. Matches: https://<bucket>.s3.<region>.amazonaws.com/…
  if (/\.s3\.[a-z0-9-]+\.amazonaws\.com\//.test(row.mediaUrl)) {
    return { skipped: true, reason: "already_on_s3" };
  }

  try {
    const res = await mirrorUrlToS3({
      organizationId: row.organizationId,
      messageId: row.id,
      url: row.mediaUrl,
      mimeType: row.mediaMimeType ?? undefined,
      authHeader: p.authHeader,
      maxBytes: 50 * 1024 * 1024,
    });
    if (!res) return { skipped: true, reason: "s3_not_configured" };
    await db
      .update(message)
      // Signed URL so the inbox UI (browser) can stream the audio/image
      // even when the bucket has Block Public Access enabled. URL is valid
      // for 24h; for older messages we'd want a /api/media/<id> proxy that
      // re-signs on demand — left for v1.1.
      .set({ mediaUrl: res.signedUrl })
      .where(eq(message.id, row.id));
    return { ok: true, key: res.key };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.warn(`[media-archive] ${row.id}: ${err}`);
    // Leave original URL in place. Let BullMQ retry (built-in exponential backoff).
    throw e;
  }
}
