import { extname } from "path";

export type S3UploadInput = {
  organizationId: string;
  messageId?: string;
  documentId?: string;
  fileName?: string;
  mimeType?: string;
  body: Buffer | Uint8Array;
};

export type S3UploadResult = {
  bucket: string;
  region: string;
  key: string;
  publicUrl: string;
};

function sanitizeFileName(name: string): string {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function extFromMime(mime?: string): string | null {
  if (!mime) return null;
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
  };
  return map[mime] ?? null;
}

/**
 * Read S3 configuration from env with this precedence:
 *   1. Our app-scoped names:  S3_BUCKET / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
 *   2. Standard AWS SDK names: AWS_S3_BUCKET / AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 *
 * Amplify reserves the `AWS_` prefix and rejects custom env vars that start
 * with it, so we use the app-scoped names there. EC2 and docker-compose can
 * use either (the AWS_* names let the SDK's default chain pick them up
 * automatically — no credential construction needed).
 */
function getS3Config(): {
  bucket?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
} {
  return {
    bucket: process.env.S3_BUCKET ?? process.env.AWS_S3_BUCKET,
    region:
      process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1",
    accessKeyId:
      process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken:
      process.env.S3_SESSION_TOKEN ?? process.env.AWS_SESSION_TOKEN,
  };
}

export function isS3Configured(): boolean {
  return Boolean(getS3Config().bucket);
}

async function buildS3Client() {
  const { region, accessKeyId, secretAccessKey, sessionToken } = getS3Config();
  const { S3Client } = await import("@aws-sdk/client-s3");
  if (accessKeyId && secretAccessKey) {
    return new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });
  }
  // No explicit credentials → let the SDK use its default chain
  // (instance profile on EC2, Amplify service role, etc.).
  return new S3Client({ region });
}

/**
 * Upload a buffer to S3 and return a stable https URL.
 *
 * Layout:
 *   <orgId>/messages/<messageId>/<filename>
 *   <orgId>/documents/<documentId>/<filename>
 */
export async function uploadToS3(input: S3UploadInput): Promise<S3UploadResult> {
  const { bucket, region } = getS3Config();
  if (!bucket) throw new Error("S3 bucket not configured (S3_BUCKET or AWS_S3_BUCKET)");

  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await buildS3Client();

  const guessedName = sanitizeFileName(
    input.fileName ||
      (input.messageId
        ? `inbound${extFromMime(input.mimeType) ?? extname(input.fileName ?? "") ?? ""}`
        : "file"),
  );

  const segment = input.messageId
    ? `messages/${input.messageId}`
    : input.documentId
      ? `documents/${input.documentId}`
      : `misc/${Date.now()}`;
  const key = `${input.organizationId}/${segment}/${guessedName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.body,
      ContentType: input.mimeType || "application/octet-stream",
    }),
  );

  const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(
    key,
  ).replace(/%2F/g, "/")}`;
  return { bucket, region, key, publicUrl };
}

/**
 * Download `url` and push to S3. Used for mirroring provider CDN URLs
 * (WhatsApp/Meta) to our bucket before they expire.
 */
export async function mirrorUrlToS3(input: {
  organizationId: string;
  messageId?: string;
  documentId?: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  authHeader?: string;
  maxBytes?: number;
}): Promise<S3UploadResult | null> {
  if (!isS3Configured()) return null;
  const headers: Record<string, string> = {};
  if (input.authHeader) headers.authorization = input.authHeader;

  const res = await fetch(input.url, { headers });
  if (!res.ok) {
    throw new Error(`fetch ${input.url} failed: ${res.status}`);
  }
  const contentType = input.mimeType || res.headers.get("content-type") || "application/octet-stream";
  const max = input.maxBytes ?? 50 * 1024 * 1024;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > max) {
    throw new Error(`media ${buf.byteLength} bytes exceeds ${max}`);
  }
  return uploadToS3({
    organizationId: input.organizationId,
    messageId: input.messageId,
    documentId: input.documentId,
    fileName: input.fileName,
    mimeType: contentType,
    body: buf,
  });
}
