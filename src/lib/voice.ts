/**
 * Voice-note → text transcription.
 *
 * Provider chain (highest priority first):
 *   1. Per-org `bot_config.transcriptionProvider` ("groq" | "openai" | "elevenlabs")
 *      with the org's own `voiceSecretsCiphertext` API key when provider
 *      matches the TTS provider, otherwise the platform-wide env keys.
 *   2. Platform fallback envs:
 *      - GROQ_API_KEY           (default — fastest, free-tier friendly)
 *      - OPENAI_API_KEY         (Whisper-1)
 *      - ELEVENLABS_API_KEY     (ElevenLabs Scribe v1, best for code-switched
 *                                Urdu / Hindi / English mixes)
 *
 * Language: auto-detected by default. The `preferredLanguage` is treated as
 * a HINT — when set, we pass it to providers that benefit from a hint
 * (Whisper). When unset / "auto", we let the provider detect.
 *
 * Output: { text, languageDetected, latencyMs, provider }.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botConfig } from "@/db/schema";
import { decryptJSON } from "@/lib/encryption";

export type TranscribeProvider = "groq" | "openai" | "elevenlabs";

export type TranscribeResult = {
  provider: TranscribeProvider;
  model: string;
  text: string;
  language?: string;
  latencyMs: number;
};

async function fetchAudio(mediaUrl: string): Promise<Blob> {
  const res = await fetch(mediaUrl);
  if (!res.ok) {
    throw new Error(`audio fetch ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const type = res.headers.get("content-type") ?? "audio/ogg";
  return new Blob([buf], { type });
}

/**
 * Whisper hint prompts. When the speaker's language is known, a short
 * prompt helps Whisper stay in that script and match colloquial vocab.
 *
 * Code-switched Urdu/Hindi/English: when no language is set we don't
 * send a prompt — Whisper auto-detects. ElevenLabs Scribe handles
 * code-switching natively.
 */
function whisperPromptForLanguage(lang?: string): string | undefined {
  if (!lang) return undefined;
  const key = lang.trim().toLowerCase().split("-")[0];
  if (key === "auto") return undefined;
  const prompts: Record<string, string> = {
    ur: "یہ ایک اردو گفتگو ہے۔ براہ کرم اسے اردو رسم الخط میں نقل کریں۔",
    hi: "यह एक हिंदी बातचीत है।",
    ar: "هذه محادثة باللغة العربية.",
  };
  return prompts[key];
}

/**
 * Resolve the org's transcription config (provider + key + lang). Falls
 * back to platform envs when the org hasn't picked one.
 */
async function resolveSttConfig(
  organizationId: string | undefined,
): Promise<{
  provider: TranscribeProvider;
  apiKey: string;
  language: string | undefined;
}> {
  let provider: TranscribeProvider = "groq";
  let language: string | undefined;
  let orgApiKey: string | null = null;
  let orgVoiceProvider: string | null = null;

  if (organizationId) {
    const [bot] = await db
      .select({
        transcriptionProvider: botConfig.transcriptionProvider,
        transcriptionLanguage: botConfig.transcriptionLanguage,
        voiceProvider: botConfig.voiceProvider,
        voiceSecretsCiphertext: botConfig.voiceSecretsCiphertext,
      })
      .from(botConfig)
      .where(eq(botConfig.organizationId, organizationId))
      .limit(1);
    if (bot) {
      const p = (bot.transcriptionProvider ?? "groq") as TranscribeProvider;
      provider = p;
      language = bot.transcriptionLanguage?.trim() || undefined;
      orgVoiceProvider = bot.voiceProvider ?? null;
      // Reuse the same encrypted secret blob the org saved — there's only
      // one `voiceSecretsCiphertext` column. If the org's STT provider
      // matches their TTS provider, the same key is used.
      if (bot.voiceSecretsCiphertext) {
        try {
          const dec = decryptJSON<{ apiKey?: string }>(
            bot.voiceSecretsCiphertext,
          );
          if (dec?.apiKey) orgApiKey = dec.apiKey;
        } catch (e) {
          console.warn(
            "[voice] decrypt org key failed:",
            (e as Error).message,
          );
        }
      }
    }
  }

  // Pick the right API key for the chosen STT provider.
  let apiKey = "";
  if (provider === "groq") {
    apiKey = process.env.GROQ_API_KEY ?? "";
  } else if (provider === "openai") {
    apiKey =
      orgVoiceProvider === "openai" && orgApiKey
        ? orgApiKey
        : (process.env.OPENAI_API_KEY ?? "");
  } else if (provider === "elevenlabs") {
    apiKey =
      orgVoiceProvider === "elevenlabs" && orgApiKey
        ? orgApiKey
        : (process.env.ELEVENLABS_API_KEY ?? "");
  }

  return { provider, apiKey, language };
}

export async function transcribeAudio(opts: {
  mediaUrl?: string;
  blob?: Blob;
  /** Falls back to org-config / platform env. */
  organizationId?: string;
  /** Caller can override; otherwise we resolve from org config. */
  preferredLanguage?: string;
  preferredProvider?: TranscribeProvider;
}): Promise<TranscribeResult> {
  const started = Date.now();
  const audio = opts.blob ?? (opts.mediaUrl ? await fetchAudio(opts.mediaUrl) : null);
  if (!audio) throw new Error("no audio input");

  const cfg = await resolveSttConfig(opts.organizationId);
  const provider = opts.preferredProvider ?? cfg.provider;
  // Resolution: explicit override → org config → auto.
  // We deliberately DON'T fall back to DEFAULT_VOICE_LANG here — that env
  // was a bootstrap convenience and pre-dates the per-org config. Honoring
  // it now forces every business onto whatever language the EC2 box was
  // initially configured for, even when their bot_config says something
  // else (or "auto").
  const explicit = opts.preferredLanguage ?? cfg.language;
  const language =
    explicit && explicit.trim().toLowerCase() !== "auto"
      ? explicit.trim().toLowerCase()
      : "auto";

  const lookup: Array<{ p: TranscribeProvider; key: string }> = [
    { p: provider, key: getKeyForProvider(provider, cfg.apiKey) },
  ];
  // Cascading fallback to other configured providers
  for (const p of ["groq", "elevenlabs", "openai"] as const) {
    if (p === provider) continue;
    const key = getKeyForProvider(p, "");
    if (key) lookup.push({ p, key });
  }

  const errs: string[] = [];
  for (const { p, key } of lookup) {
    if (!key) continue;
    try {
      if (p === "groq") {
        return await transcribeGroq(audio, key, language, started);
      }
      if (p === "openai") {
        return await transcribeOpenAI(audio, key, language, started);
      }
      if (p === "elevenlabs") {
        return await transcribeElevenLabs(audio, key, language, started);
      }
    } catch (e) {
      errs.push(`${p}: ${(e as Error).message}`);
      console.warn(`[voice] ${p} failed, trying next:`, (e as Error).message);
    }
  }

  throw new Error(
    `No transcription provider succeeded. Configure GROQ_API_KEY / OPENAI_API_KEY / ELEVENLABS_API_KEY (or per-org in Bot → Voice). Errors: ${
      errs.join(" | ") || "no API key configured"
    }`,
  );
}

function getKeyForProvider(p: TranscribeProvider, orgKey: string): string {
  if (p === "groq") return process.env.GROQ_API_KEY ?? "";
  if (p === "openai") return orgKey || (process.env.OPENAI_API_KEY ?? "");
  if (p === "elevenlabs")
    return orgKey || (process.env.ELEVENLABS_API_KEY ?? "");
  return "";
}

async function transcribeGroq(
  audio: Blob,
  apiKey: string,
  language: string,
  started: number,
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("file", audio, "voice.ogg");
  form.append(
    "model",
    process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo",
  );
  // Auto-detect by default. If a language is hinted, pass it + prompt.
  if (language && language !== "auto") {
    form.append("language", language);
    const prompt = whisperPromptForLanguage(language);
    if (prompt) form.append("prompt", prompt);
  }
  form.append("response_format", "verbose_json");
  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    },
  );
  if (!res.ok)
    throw new Error(`groq transcribe ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { text?: string; language?: string };
  return {
    provider: "groq",
    model: process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo",
    text: json.text ?? "",
    language: json.language,
    latencyMs: Date.now() - started,
  };
}

async function transcribeOpenAI(
  audio: Blob,
  apiKey: string,
  language: string,
  started: number,
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("file", audio, "voice.ogg");
  form.append("model", process.env.OPENAI_WHISPER_MODEL ?? "whisper-1");
  if (language && language !== "auto") {
    form.append("language", language);
    const prompt = whisperPromptForLanguage(language);
    if (prompt) form.append("prompt", prompt);
  }
  form.append("response_format", "verbose_json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`openai transcribe ${res.status}`);
  const json = (await res.json()) as { text?: string; language?: string };
  return {
    provider: "openai",
    model: process.env.OPENAI_WHISPER_MODEL ?? "whisper-1",
    text: json.text ?? "",
    language: json.language,
    latencyMs: Date.now() - started,
  };
}

/**
 * ElevenLabs Scribe v1 — multilingual STT with native handling for
 * code-switched audio (Urdu + English mixed, Hinglish, etc.). Strong
 * on noisy audio and accents.
 *
 * Docs: https://elevenlabs.io/docs/api-reference/speech-to-text
 */
async function transcribeElevenLabs(
  audio: Blob,
  apiKey: string,
  language: string,
  started: number,
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("file", audio, "voice.ogg");
  form.append("model_id", "scribe_v1");
  // Scribe takes ISO-639-3 hints (urd/hin/eng) but auto-detects when
  // omitted. Convert common BCP-47 codes.
  if (language && language !== "auto") {
    const iso3 = bcp47ToIso3(language);
    if (iso3) form.append("language_code", iso3);
  }
  form.append("diarize", "false");
  form.append("tag_audio_events", "false");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`elevenlabs scribe ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    text?: string;
    language_code?: string;
    language_probability?: number;
  };
  return {
    provider: "elevenlabs",
    model: "scribe_v1",
    text: json.text ?? "",
    language: json.language_code,
    latencyMs: Date.now() - started,
  };
}

function bcp47ToIso3(lang: string): string | undefined {
  const k = lang.trim().toLowerCase().split("-")[0];
  const map: Record<string, string> = {
    ur: "urd",
    hi: "hin",
    en: "eng",
    ar: "ara",
    es: "spa",
    pt: "por",
    fr: "fra",
    de: "deu",
    it: "ita",
    tr: "tur",
    ru: "rus",
    bn: "ben",
    pa: "pan",
    fa: "fas",
  };
  return map[k];
}
