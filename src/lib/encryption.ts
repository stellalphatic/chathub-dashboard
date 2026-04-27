/**
 * AES-256-GCM authenticated encryption for provider credentials stored in DB.
 *
 * ENCRYPTION_KEY env must be a 32-byte key, base64 or hex encoded.
 *   openssl rand -base64 32
 *
 * Rotating: generate a new key, keep the old one in ENCRYPTION_KEY_PREVIOUS so
 * running decrypts still work; migrate rows lazily (decrypt w/ old, re-encrypt
 * w/ new) via a background job. (Rotation script is a future TODO.)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM recommended
const TAG_LEN = 16;

/**
 * Static env reads. Next.js can ONLY inline `process.env.X` (static property
 * access) at build time. Bracket access like `process.env[name]` is dynamic
 * and falls through to the Lambda runtime — which on Amplify sometimes
 * doesn't carry the value, even when it's set in the console.
 *
 * Keep this list aligned with `serverEnv` in next.config.ts.
 */
function readEnvByName(envName: string): string | undefined {
  switch (envName) {
    case "ENCRYPTION_KEY":
      return process.env.ENCRYPTION_KEY || undefined;
    case "ENCRYPTION_KEY_PREVIOUS":
      return process.env.ENCRYPTION_KEY_PREVIOUS || undefined;
    default:
      return undefined;
  }
}

function loadKey(envName: string): Buffer | null {
  const raw = readEnvByName(envName);
  if (!raw) return null;
  const trimmed = raw.trim();
  // Accept either base64 or hex
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length === 64) {
    return Buffer.from(trimmed, "hex");
  }
  const buf = Buffer.from(trimmed, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `${envName} must decode to 32 bytes (got ${buf.length}). Generate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

function getPrimaryKey(): Buffer {
  const key = loadKey("ENCRYPTION_KEY");
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY is required in production. Generate: openssl rand -base64 32",
      );
    }
    // Dev fallback: deterministic so restarts can still decrypt, but DO NOT ship.
    return Buffer.from(
      "devdevdevdevdevdevdevdevdevdev1234567890aa=",
      "base64",
    ).subarray(0, 32);
  }
  return key;
}

/** Encrypt a UTF-8 string. Output format: v1.<ivB64>.<tagB64>.<cipherB64> */
export function encryptString(plain: string): string {
  const key = getPrimaryKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptString(ciphertext: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid ciphertext format");
  }
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const enc = Buffer.from(parts[3], "base64");
  if (tag.length !== TAG_LEN) throw new Error("Invalid auth tag length");

  const keys = [getPrimaryKey()];
  const prev = loadKey("ENCRYPTION_KEY_PREVIOUS");
  if (prev) keys.push(prev);

  let lastErr: unknown;
  for (const key of keys) {
    try {
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
      return dec.toString("utf8");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("decrypt failed");
}

export function encryptJSON(obj: Record<string, unknown>): string {
  return encryptString(JSON.stringify(obj));
}

export function decryptJSON<T = Record<string, unknown>>(ciphertext: string): T {
  return JSON.parse(decryptString(ciphertext)) as T;
}
