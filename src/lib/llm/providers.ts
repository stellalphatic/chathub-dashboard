import type {
  LlmCompleteInput,
  LlmCompleteOutput,
  LlmProvider,
  LlmProviderName,
} from "./types";

/**
 * Thin, streaming-optional adapters for each provider. We use the provider's
 * official SDK only when it adds real value (schemas, retries). Otherwise we
 * use fetch() to keep bundle size and cold-start low (Amplify/Lambda).
 *
 * All adapters:
 *   - accept OpenAI-style messages,
 *   - return { text, tokens, latencyMs },
 *   - throw on 4xx/5xx so the router can fail over.
 */

// ─────────────────────────────────────────────────────────────────────────────
// GROQ (primary) — extremely fast. Uses Llama 3.3 70B Versatile by default.
// https://console.groq.com/docs/api-reference#chat
// ─────────────────────────────────────────────────────────────────────────────

class GroqProvider implements LlmProvider {
  readonly name: LlmProviderName = "groq";
  defaultModel: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: { apiKey: string; defaultModel?: string; baseUrl?: string }) {
    this.apiKey = opts.apiKey;
    this.defaultModel = opts.defaultModel ?? "llama-3.3-70b-versatile";
    this.baseUrl = opts.baseUrl ?? "https://api.groq.com/openai/v1";
  }

  async complete(input: LlmCompleteInput): Promise<LlmCompleteOutput> {
    const started = Date.now();
    const model = input.model ?? this.defaultModel;
    const controller = new AbortController();
    const t = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 25_000,
    );
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxOutputTokens ?? 512,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Groq ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const text = json.choices[0]?.message?.content ?? "";
      const u = json.usage ?? {};
      return {
        provider: this.name,
        model,
        text,
        promptTokens: u.prompt_tokens ?? 0,
        completionTokens: u.completion_tokens ?? 0,
        totalTokens:
          u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(t);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI (fallback 1) — Google. Uses gemini-1.5-flash by default.
// ─────────────────────────────────────────────────────────────────────────────

class GeminiProvider implements LlmProvider {
  readonly name: LlmProviderName = "gemini";
  defaultModel: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: { apiKey: string; defaultModel?: string; baseUrl?: string }) {
    this.apiKey = opts.apiKey;
    this.defaultModel = opts.defaultModel ?? "gemini-1.5-flash";
    this.baseUrl =
      opts.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  async complete(input: LlmCompleteInput): Promise<LlmCompleteOutput> {
    const started = Date.now();
    const model = input.model ?? this.defaultModel;
    // Gemini treats system separately
    const systemText = input.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = input.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const controller = new AbortController();
    const t = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 25_000,
    );
    try {
      const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: systemText
            ? { role: "system", parts: [{ text: systemText }] }
            : undefined,
          contents,
          generationConfig: {
            temperature: input.temperature ?? 0.3,
            maxOutputTokens: input.maxOutputTokens ?? 512,
          },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };
      const text =
        json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
        "";
      const u = json.usageMetadata ?? {};
      return {
        provider: this.name,
        model,
        text,
        promptTokens: u.promptTokenCount ?? 0,
        completionTokens: u.candidatesTokenCount ?? 0,
        totalTokens: u.totalTokenCount ?? 0,
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(t);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI (final fallback)
// ─────────────────────────────────────────────────────────────────────────────

class OpenAIProvider implements LlmProvider {
  readonly name: LlmProviderName = "openai";
  defaultModel: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: { apiKey: string; defaultModel?: string; baseUrl?: string }) {
    this.apiKey = opts.apiKey;
    this.defaultModel = opts.defaultModel ?? "gpt-4o-mini";
    this.baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
  }

  async complete(input: LlmCompleteInput): Promise<LlmCompleteOutput> {
    const started = Date.now();
    const model = input.model ?? this.defaultModel;
    const controller = new AbortController();
    const t = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 25_000,
    );
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxOutputTokens ?? 512,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const text = json.choices[0]?.message?.content ?? "";
      const u = json.usage ?? {};
      return {
        provider: this.name,
        model,
        text,
        promptTokens: u.prompt_tokens ?? 0,
        completionTokens: u.completion_tokens ?? 0,
        totalTokens:
          u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(t);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderCredential =
  | { provider: "groq"; apiKey: string; defaultModel?: string }
  | { provider: "gemini"; apiKey: string; defaultModel?: string }
  | { provider: "openai"; apiKey: string; defaultModel?: string };

export function makeProvider(cred: ProviderCredential): LlmProvider {
  switch (cred.provider) {
    case "groq":
      return new GroqProvider({
        apiKey: cred.apiKey,
        defaultModel: cred.defaultModel,
      });
    case "gemini":
      return new GeminiProvider({
        apiKey: cred.apiKey,
        defaultModel: cred.defaultModel,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey: cred.apiKey,
        defaultModel: cred.defaultModel,
      });
  }
}
