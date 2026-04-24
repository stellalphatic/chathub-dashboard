/**
 * Voice-note → text transcription. Groq hosts Whisper-large-v3-turbo which is
 * ~10-20x faster than OpenAI Whisper and free-tier friendly. We use that by
 * default and fall back to OpenAI if Groq is missing or the call fails.
 *
 * Input: mediaUrl (publicly accessible) OR ArrayBuffer.
 * Output: { text, languageDetected, latencyMs }.
 */

export type TranscribeResult = {
  provider: "groq" | "openai";
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
 * Language-specific Whisper prompt. When set, Whisper biases its output
 * towards the prompt's script. This matters for Urdu/Hindi because:
 *   - Spoken Urdu and Hindi are ~90% identical (mutually intelligible).
 *   - Whisper will happily output either script based on weak signals.
 *   - To force Urdu Arabic script even when the speaker uses Hindi vocab,
 *     we pass `language=ur` AND a sample Urdu prompt.
 */
function whisperPromptForLanguage(lang: string): string | undefined {
  const key = lang.trim().toLowerCase().split("-")[0];
  const prompts: Record<string, string> = {
    ur: "یہ ایک اردو گفتگو ہے۔ براہ کرم اسے اردو رسم الخط میں نقل کریں۔",
    hi: "यह एक हिंदी बातचीत है।",
    ar: "هذه محادثة باللغة العربية.",
  };
  return prompts[key];
}

export async function transcribeAudio(opts: {
  mediaUrl?: string;
  blob?: Blob;
  preferredLanguage?: string;
}): Promise<TranscribeResult> {
  const started = Date.now();
  const audio = opts.blob ?? (opts.mediaUrl ? await fetchAudio(opts.mediaUrl) : null);
  if (!audio) throw new Error("no audio input");

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const form = new FormData();
      form.append("file", audio, "voice.ogg");
      form.append("model", process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo");
      if (opts.preferredLanguage) {
        form.append("language", opts.preferredLanguage);
        const prompt = whisperPromptForLanguage(opts.preferredLanguage);
        if (prompt) form.append("prompt", prompt);
      }
      form.append("response_format", "verbose_json");
      const res = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { authorization: `Bearer ${groqKey}` },
          body: form,
        },
      );
      if (!res.ok) throw new Error(`groq transcribe ${res.status}: ${await res.text()}`);
      const json = (await res.json()) as { text?: string; language?: string };
      return {
        provider: "groq",
        model: "whisper-large-v3-turbo",
        text: json.text ?? "",
        language: json.language,
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      console.warn("[voice] groq whisper failed, trying openai:", e);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const form = new FormData();
    form.append("file", audio, "voice.ogg");
    form.append("model", process.env.OPENAI_WHISPER_MODEL ?? "whisper-1");
    if (opts.preferredLanguage) {
      form.append("language", opts.preferredLanguage);
      const prompt = whisperPromptForLanguage(opts.preferredLanguage);
      if (prompt) form.append("prompt", prompt);
    }
    form.append("response_format", "verbose_json");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`openai transcribe ${res.status}`);
    const json = (await res.json()) as { text?: string; language?: string };
    return {
      provider: "openai",
      model: "whisper-1",
      text: json.text ?? "",
      language: json.language,
      latencyMs: Date.now() - started,
    };
  }

  throw new Error("No transcription provider configured (set GROQ_API_KEY or OPENAI_API_KEY)");
}
