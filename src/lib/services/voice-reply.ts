import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversation, customer, message } from "@/db/schema";
import { isS3Configured, uploadToS3 } from "@/lib/media/s3";
import { tryTranscodeToOggOpus } from "@/lib/media/transcode";
import { loadChannelConnection } from "@/lib/providers/sender-factory";
import { synthesizeSpeech } from "@/lib/tts";

/**
 * Generate a TTS reply, upload to S3, send via the org's WhatsApp connection.
 *
 * Returns true on success (audio sent + DB row inserted), false otherwise.
 * The caller should always send a text reply too if this returns false —
 * we never want a silent failure to leave the customer with no reply.
 *
 * Pre-conditions:
 *   - bot_config.voiceReplyEnabled = true (verified by `synthesizeSpeech`)
 *   - S3 configured (we need a public-ish URL for YCloud to fetch)
 *   - Conversation has a channel_connection
 */
export async function maybeSendVoiceReply(opts: {
  organizationId: string;
  conversationId: string;
  /** The text the LLM produced — what we'll synthesize. */
  text: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isS3Configured()) {
    return { ok: false, reason: "s3 not configured" };
  }

  // Load conversation + customer + connection in parallel.
  const [[conv], [cust]] = await Promise.all([
    db
      .select()
      .from(conversation)
      .where(eq(conversation.id, opts.conversationId))
      .limit(1),
    (async () => {
      const [c] = await db
        .select()
        .from(conversation)
        .where(eq(conversation.id, opts.conversationId))
        .limit(1);
      if (!c) return [];
      return db
        .select()
        .from(customer)
        .where(eq(customer.id, c.customerId))
        .limit(1);
    })(),
  ]);
  if (!conv) return { ok: false, reason: "conversation missing" };
  if (!cust) return { ok: false, reason: "customer missing" };
  if (!conv.channelConnectionId)
    return { ok: false, reason: "no channel connection" };
  if (cust.phoneE164.startsWith("ext:")) {
    // IG/FB don't have voice reply parity; skip until we add per-channel handling.
    return { ok: false, reason: "channel does not support voice reply" };
  }

  // 1. Synthesize.
  let tts;
  try {
    tts = await synthesizeSpeech(opts.organizationId, opts.text);
  } catch (e) {
    return { ok: false, reason: `tts failed: ${(e as Error).message}` };
  }
  if (!tts) return { ok: false, reason: "tts not configured" };

  // 2. Transcode MP3 → OGG OPUS so WhatsApp shows the green "voice note"
  //    bubble (and modern browsers play OGG OPUS natively in <audio>).
  //    Falls through to the original MP3 if ffmpeg isn't available.
  const transcoded = await tryTranscodeToOggOpus(tts.audio);
  console.log(
    `[voice-reply] tts=${tts.audio.byteLength}B → ${transcoded.ext}=${transcoded.buffer.byteLength}B (transcoded=${transcoded.transcoded})`,
  );

  // 3. Upload to S3 + use the signed URL for provider GETs.
  let audioUrl: string;
  let outboundCanonicalUrl: string;
  let outboundMessageId: string;
  try {
    outboundMessageId = randomUUID();
    const res = await uploadToS3({
      organizationId: opts.organizationId,
      messageId: outboundMessageId,
      fileName: `reply-${Date.now()}.${transcoded.ext}`,
      mimeType: transcoded.mimeType,
      body: transcoded.buffer,
    });
    audioUrl = res.signedUrl;
    // Store the canonical S3 (signed) URL on the message row. The inbox
    // UI rewrites it to /api/v1/media/<id> on the client so it always
    // gets a fresh signed URL through our auth-protected proxy.
    outboundCanonicalUrl = res.signedUrl;
  } catch (e) {
    return { ok: false, reason: `s3 upload failed: ${(e as Error).message}` };
  }

  // 3. Send via the channel.
  try {
    const conn = await loadChannelConnection(conv.channelConnectionId);
    if (!conn.sender.sendAudio) {
      return { ok: false, reason: "sender does not support audio" };
    }
    const sendRes = await conn.sender.sendAudio({
      toPhoneE164: cust.phoneE164,
      audioUrl,
    });

    // 4. Persist as an outbound voice_note message so the inbox shows it.
    await db.insert(message).values({
      id: outboundMessageId,
      organizationId: opts.organizationId,
      customerId: cust.id,
      conversationId: conv.id,
      channel: conv.channel,
      direction: "outbound",
      contentType: "voice_note",
      // Keep the script as `body` so the inbox preview shows useful text + the
      // bot's transcript stays searchable.
      body: opts.text,
      mediaUrl: outboundCanonicalUrl,
      mediaMimeType: transcoded.mimeType,
      transcript: opts.text,
      sentByBot: true,
      status: "sent",
      providerMessageId: sendRes.providerMessageId,
    });

    await db
      .update(conversation)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: `🎙 ${opts.text.slice(0, 120)}`,
        updatedAt: new Date(),
      })
      .where(eq(conversation.id, conv.id));

    console.log(
      `[voice-reply] sent ${tts.provider}/${tts.model} ${tts.audio.byteLength}B in ${tts.latencyMs}ms`,
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `send failed: ${(e as Error).message}` };
  }
}
