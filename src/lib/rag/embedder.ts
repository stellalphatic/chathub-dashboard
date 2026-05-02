/**
 * Embedding with provider fallback: Gemini → OpenAI.
 *   - Gemini text-embedding-004 is 768 dim and free tier friendly.
 *   - OpenAI text-embedding-3-small is 1536 dim.
 *
 * Both vector stores (Qdrant + Pinecone) are told which dim to expect
 * through the EMBED_DIMENSION env var — pick one, don't mix.
 */

export type EmbedInput = string | string[];

export type EmbedOutput = {
  provider: "gemini" | "openai";
  model: string;
  dim: number;
  vectors: number[][];
};

async function embedGemini(
  inputs: string[],
  apiKey: string,
): Promise<EmbedOutput> {
  const model = process.env.GEMINI_EMBED_MODEL ?? "text-embedding-004";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requests: inputs.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Gemini embed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    embeddings?: { values?: number[] }[];
  };
  const vectors = (json.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== inputs.length) {
    throw new Error("Gemini embed count mismatch");
  }
  return {
    provider: "gemini",
    model,
    dim: vectors[0]?.length ?? 0,
    vectors,
  };
}

async function embedOpenAI(
  inputs: string[],
  apiKey: string,
): Promise<EmbedOutput> {
  const model = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) throw new Error(`OpenAI embed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    data: { embedding: number[] }[];
  };
  const vectors = json.data.map((d) => d.embedding);
  return {
    provider: "openai",
    model,
    dim: vectors[0]?.length ?? 0,
    vectors,
  };
}

export async function embed(input: EmbedInput): Promise<EmbedOutput> {
  const inputs = Array.isArray(input) ? input : [input];
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const errs: string[] = [];
  if (geminiKey) {
    try {
      return await embedGemini(inputs, geminiKey);
    } catch (e) {
      errs.push(`gemini: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (openaiKey) {
    try {
      return await embedOpenAI(inputs, openaiKey);
    } catch (e) {
      errs.push(`openai: ${e instanceof Error ? e.message : e}`);
    }
  }
  const detail =
    errs.join(" | ") ||
    "no API key configured — set GEMINI_API_KEY or OPENAI_API_KEY on the machine that runs BullMQ workers (EC2/docker), not only on Amplify; embeddings never run in the Next.js Lambda.";
  throw new Error(`No embedding provider succeeded. ${detail}`);
}
