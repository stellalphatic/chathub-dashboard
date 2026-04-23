/**
 * Simple, deterministic text chunker optimized for retrieval (not re-ranking).
 *
 * Strategy:
 *   1. Normalize whitespace and split on hard paragraph breaks.
 *   2. Merge short paragraphs into ~900-char windows with ~150-char overlap.
 *
 * We keep the code dependency-free (no tokenizer); that's fine because
 * retrieval is tolerant and embeddings are cheap.
 */

export type Chunk = {
  ord: number;
  content: string;
  // rough tokens = chars/4
  tokens: number;
};

const TARGET_CHARS = 900;
const OVERLAP_CHARS = 150;
const MIN_CHARS = 80;

export function chunkText(input: string): Chunk[] {
  const normalized = input
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .trim();

  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: Chunk[] = [];
  let buf = "";

  const push = () => {
    const trimmed = buf.trim();
    if (trimmed.length >= MIN_CHARS) {
      out.push({
        ord: out.length,
        content: trimmed,
        tokens: Math.ceil(trimmed.length / 4),
      });
    }
    buf = "";
  };

  for (const para of paragraphs) {
    if ((buf.length + para.length + 2) <= TARGET_CHARS) {
      buf += (buf ? "\n\n" : "") + para;
      continue;
    }

    // If a single paragraph is huge, hard-split it.
    if (para.length > TARGET_CHARS) {
      if (buf) push();
      let i = 0;
      while (i < para.length) {
        const slice = para.slice(i, i + TARGET_CHARS);
        out.push({
          ord: out.length,
          content: slice,
          tokens: Math.ceil(slice.length / 4),
        });
        i += TARGET_CHARS - OVERLAP_CHARS;
      }
      continue;
    }

    // Flush current buffer and start new one with overlap from tail.
    push();
    buf = para;
  }
  if (buf) push();

  // Add overlap between consecutive chunks: prepend last OVERLAP_CHARS of
  // previous chunk to the start of the next.
  return out.map((c, i) => {
    if (i === 0) return c;
    const prev = out[i - 1];
    const tail = prev.content.slice(-OVERLAP_CHARS);
    return {
      ...c,
      content: `${tail}\n${c.content}`,
      tokens: Math.ceil((tail.length + c.content.length) / 4),
    };
  });
}
