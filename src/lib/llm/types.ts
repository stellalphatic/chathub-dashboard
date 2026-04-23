export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmProviderName = "groq" | "gemini" | "openai";

export type LlmCompleteInput = {
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Force a specific model (otherwise provider default is used). */
  model?: string;
  /** Hard deadline in ms (caller aborts after this). */
  timeoutMs?: number;
};

export type LlmCompleteOutput = {
  provider: LlmProviderName;
  model: string;
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
};

export type LlmProvider = {
  name: LlmProviderName;
  defaultModel: string;
  complete(input: LlmCompleteInput): Promise<LlmCompleteOutput>;
};
