import { spawn } from "child_process";

/**
 * Transcode an audio buffer to OGG OPUS using ffmpeg from PATH.
 *
 * WhatsApp's API recognizes OGG OPUS as a "voice note" — that's what
 * shows the green play-bar bubble in WhatsApp. MP3 files get displayed
 * as a generic audio file with a less native UI.
 *
 * Browsers (Chrome, Edge, Safari 14.5+, Firefox) all play OGG OPUS in
 * `<audio>` natively, so the same file works for the inbox player too.
 *
 * Parameters tuned for voice (mono, 16 kHz, 24 kbps) — small files,
 * crisp speech, no music-quality overhead.
 */
export async function transcodeToOggOpus(input: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    // -i pipe:0  read from stdin
    // -vn        no video
    // -acodec libopus
    // -ac 1     mono
    // -ar 16000 16 kHz sample rate (plenty for voice)
    // -b:a 24k  ~24 kbps — sounds great for speech, ~15 KB per 5 s
    // -application voip   Opus tuned for speech intelligibility
    // -f ogg    OGG container
    // pipe:1    write to stdout
    const proc = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-vn",
        "-acodec",
        "libopus",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "24k",
        "-application",
        "voip",
        "-f",
        "ogg",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(out));
      } else {
        reject(
          new Error(
            `ffmpeg exited ${code}: ${Buffer.concat(err).toString("utf8").slice(0, 500)}`,
          ),
        );
      }
    });

    proc.stdin.end(input);
  });
}

/**
 * Best-effort: try transcoding, fall through to the original buffer
 * (with original mime) on any failure. The caller can then upload MP3
 * — it'll still play in WhatsApp (just as a non-voice-note audio file)
 * and in the browser.
 */
export async function tryTranscodeToOggOpus(
  input: Buffer,
): Promise<{ buffer: Buffer; mimeType: string; ext: string; transcoded: boolean }> {
  try {
    const ogg = await transcodeToOggOpus(input);
    return {
      buffer: ogg,
      mimeType: "audio/ogg",
      ext: "ogg",
      transcoded: true,
    };
  } catch (e) {
    console.warn(
      "[transcode] mp3→ogg-opus failed, sending mp3 as-is:",
      (e as Error).message,
    );
    return {
      buffer: input,
      mimeType: "audio/mpeg",
      ext: "mp3",
      transcoded: false,
    };
  }
}
