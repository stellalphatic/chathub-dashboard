/**
 * Text-to-speech provider router.
 *
 * Resolution order (highest priority first):
 *   1. Per-org `bot_config.voiceProvider / voiceVoiceId / voiceModel /
 *      voiceSecretsCiphertext` — pulls + decrypts the API key.
 *   2. Platform fallback envs (rare in production):
 *      ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
 *      OPENAI_API_KEY (for OpenAI TTS).
 *
 * Returns Buffer + mimeType so the caller can upload to S3 and forward
 * to the WhatsApp / IG / FB sender. Any failure throws — caller decides
 * whether to fall back to a text reply.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botConfig } from "@/db/schema";
import { decryptJSON } from "@/lib/encryption";

export type TtsResult = {
  audio: Buffer;
  mimeType: string;
  provider: "elevenlabs" | "openai";
  voiceId: string;
  model: string;
  latencyMs: number;
};

type ResolvedTtsConfig =
  | {
      provider: "elevenlabs";
      apiKey: string;
      voiceId: string;
      model: string;
    }
  | {
      provider: "openai";
      apiKey: string;
      voiceId: string;
      model: string;
    }
  | null;

/**
 * Pull the org's TTS config + key. Falls back to platform envs.
 * Returns null when nothing is configured (caller should reply with text).
 */
export async function resolveTtsConfig(
  organizationId: string,
): Promise<ResolvedTtsConfig> {
  const [bot] = await db
    .select({
      voiceReplyEnabled: botConfig.voiceReplyEnabled,
      voiceProvider: botConfig.voiceProvider,
      voiceVoiceId: botConfig.voiceVoiceId,
      voiceModel: botConfig.voiceModel,
      voiceSecretsCiphertext: botConfig.voiceSecretsCiphertext,
    })
    .from(botConfig)
    .where(eq(botConfig.organizationId, organizationId))
    .limit(1);

  // No bot config row, or voice disabled, OR provider="none" → skip.
  if (!bot || !bot.voiceReplyEnabled) return null;
  const provider = (bot.voiceProvider ?? "elevenlabs") as
    | "elevenlabs"
    | "openai"
    | "none";
  if (provider === "none") return null;

  // Decrypt org-level key if present.
  let orgApiKey: string | null = null;
  if (bot.voiceSecretsCiphertext) {
    try {
      const dec = decryptJSON<{ apiKey?: string }>(bot.voiceSecretsCiphertext);
      if (dec?.apiKey) orgApiKey = dec.apiKey;
    } catch (e) {
      console.warn("[tts] decrypt org key failed:", (e as Error).message);
    }
  }

  if (provider === "elevenlabs") {
    const apiKey = orgApiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    const voiceId =
      (bot.voiceVoiceId && bot.voiceVoiceId.trim()) ||
      process.env.ELEVENLABS_VOICE_ID ||
      "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs "Rachel" — safe default
    const model =
      (bot.voiceModel && bot.voiceModel.trim()) || "eleven_turbo_v2";
    if (!apiKey) return null;
    return { provider, apiKey, voiceId, model };
  }

  // openai TTS
  const apiKey = orgApiKey ?? process.env.OPENAI_API_KEY ?? "";
  const voiceId =
    (bot.voiceVoiceId && bot.voiceVoiceId.trim()) || "alloy";
  const model = (bot.voiceModel && bot.voiceModel.trim()) || "tts-1";
  if (!apiKey) return null;
  return { provider: "openai", apiKey, voiceId, model };
}

/**
 * Synthesize speech from `text` using the org's TTS config. Throws on any
 * failure — caller wraps with try/catch and falls back to text reply.
 *
 * Output is always MP3 (the format both YCloud and WhatsApp Cloud API
 * accept for outbound `audio` messages).
 */
export async function synthesizeSpeech(
  organizationId: string,
  text: string,
): Promise<TtsResult | null> {
  const cfg = await resolveTtsConfig(organizationId);
  if (!cfg) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const started = Date.now();
  if (cfg.provider === "elevenlabs") {
    return await synthesizeElevenLabs(cfg, trimmed, started);
  }
  return await synthesizeOpenAI(cfg, trimmed, started);
}

async function synthesizeElevenLabs(
  cfg: { apiKey: string; voiceId: string; model: string },
  text: string,
  started: number,
): Promise<TtsResult> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    cfg.voiceId,
  )}?output_format=mp3_44100_128`;

  // Hard budget: 25s — beyond this we'd rather fall back to text.
  const ctrl = new AbortController();
  const tmo = setTimeout(() => ctrl.abort(), 25_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": cfg.apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: cfg.model,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`elevenlabs ${res.status}: ${body.slice(0, 250)}`);
    }
    const arr = new Uint8Array(await res.arrayBuffer());
    return {
      audio: Buffer.from(arr),
      mimeType: "audio/mpeg",
      provider: "elevenlabs",
      voiceId: cfg.voiceId,
      model: cfg.model,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(tmo);
  }
}

async function synthesizeOpenAI(
  cfg: { apiKey: string; voiceId: string; model: string },
  text: string,
  started: number,
): Promise<TtsResult> {
  const ctrl = new AbortController();
  const tmo = setTimeout(() => ctrl.abort(), 25_000);

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        voice: cfg.voiceId,
        input: text,
        format: "mp3",
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`openai-tts ${res.status}: ${body.slice(0, 250)}`);
    }
    const arr = new Uint8Array(await res.arrayBuffer());
    return {
      audio: Buffer.from(arr),
      mimeType: "audio/mpeg",
      provider: "openai",
      voiceId: cfg.voiceId,
      model: cfg.model,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(tmo);
  }
}
