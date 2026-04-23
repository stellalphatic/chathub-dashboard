/**
 * File → plain text parsing for RAG ingestion.
 * Kept in its own module so the worker can import lazy: pdf-parse and mammoth
 * are heavy and we don't want them in the web runtime bundle.
 */

export async function parseFileToText(opts: {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<string> {
  const mt = (opts.mimeType ?? "").toLowerCase();
  const name = (opts.filename ?? "").toLowerCase();

  if (mt === "application/pdf" || name.endsWith(".pdf")) {
    const { default: pdfParse } = await import("pdf-parse");
    const data = await pdfParse(opts.buffer);
    return data.text ?? "";
  }

  if (
    mt === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer: opts.buffer });
    return out.value ?? "";
  }

  // Plain text fallback (html, md, txt, csv…)
  // For HTML strip tags crudely; a full parser isn't worth the bundle cost.
  const text = opts.buffer.toString("utf8");
  if (mt === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return text;
}
