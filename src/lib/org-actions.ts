"use server";

import { randomBytes, randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  botConfig,
  botFaq,
  broadcast,
  channelConnection,
  conversation,
  customer,
  document,
  message,
  scheduledMessage,
  template,
  user as userTable,
} from "@/db/schema";
import { invalidateBotConfigCache } from "@/lib/cache/bot-config";
import { encryptJSON } from "@/lib/encryption";
import { getOrgAccess } from "@/lib/org-access";
import { formatBusinessChannelLabel } from "@/lib/channels/display-label";
import {
  fetchInstagramBusinessAccountProfile,
  fetchInstagramBusinessMeInstagramGraph,
  fetchMessengerPageName,
  probeInstagramLoginToken,
  resolveInstagramBusinessUserId,
  resolveInstagramPageAccessToken,
} from "@/lib/providers/meta-resolve";
import { exchangeForLongLivedUserToken } from "@/lib/providers/meta-token";
import {
  enqueue,
  QUEUES,
  safeEnqueue,
  type BroadcastRunnerJob,
  type EmbedDocumentJob,
  type OutboundSendJob,
} from "@/lib/queue";
import { queueOutboundMessage } from "@/lib/services/outbound";

async function requireAccess(orgSlug: string) {
  const access = await getOrgAccess(orgSlug);
  if (!access) throw new Error("unauthorized");
  return access;
}

async function isUserPlatformStaff(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return Boolean(row?.platformAdmin);
}

function isOrgClientConfigReadOnlyLocked(org: { settings: unknown }): boolean {
  if (process.env.CHATHUB_FORCE_CLIENT_CONFIG_READ_ONLY === "true") {
    return true;
  }
  const s = org.settings;
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  return Boolean((s as Record<string, unknown>).clientConfigReadOnly);
}

type OrgRow = NonNullable<Awaited<ReturnType<typeof getOrgAccess>>>["org"];

type OrgIntegrationGate = { ok: true; org: OrgRow; userId: string } | { ok: false; error: string };

/**
 * Bot persona, FAQs, documents, templates, channels, broadcasts — STAFF ONLY.
 *
 * Product rule: business users never configure anything. All write paths for
 * configuration flow through platform admins. The per-org `clientConfigReadOnly`
 * setting is kept for backwards-compat but the lock is now the default.
 */
async function requireOrgIntegrationWrite(orgSlug: string): Promise<OrgIntegrationGate> {
  const access = await getOrgAccess(orgSlug);
  if (!access) return { ok: false, error: "Unauthorized" };
  const { org, userId } = access;
  if (await isUserPlatformStaff(userId)) return { ok: true, org, userId };
  // Soft escape hatch: leave CHATHUB_FORCE_CLIENT_CONFIG_READ_ONLY unset AND
  // the org setting `clientConfigReadOnly` explicitly false to let members edit.
  if (isOrgClientConfigReadOnlyLocked(org) || isOrgClientConfigDefaultLocked(org)) {
    return {
      ok: false,
      error:
        "This section is managed by Clona staff. Contact your administrator to request changes.",
    };
  }
  return { ok: true, org, userId };
}

/**
 * Lock by default: if the org settings don't explicitly say
 * `clientConfigReadOnly: false`, we treat it as locked. Flip to false in the
 * admin console if you want a particular business to self-serve.
 */
function isOrgClientConfigDefaultLocked(org: { settings: unknown }): boolean {
  const s = org.settings;
  if (!s || typeof s !== "object" || Array.isArray(s)) return true;
  const v = (s as Record<string, unknown>).clientConfigReadOnly;
  // Unset or truthy = locked; only explicit `false` opens up writes.
  return v !== false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversations / messaging
// ─────────────────────────────────────────────────────────────────────────────

const sendSchema = z.object({
  orgSlug: z.string().min(1),
  conversationId: z.string().min(1),
  body: z.string().min(1).max(4000).optional(),
  templateId: z.string().min(1).optional(),
  templateVariables: z.record(z.string()).optional(),
});

export async function sendMessageAction(
  raw: z.infer<typeof sendSchema>,
): Promise<{ ok: true; messageId: string } | { error: string }> {
  const p = sendSchema.safeParse(raw);
  if (!p.success) {
    const issues = p.error.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    return { error: issues || "Invalid input" };
  }
  const { org, userId } = await requireAccess(p.data.orgSlug);

  const [conv] = await db
    .select({ id: conversation.id, organizationId: conversation.organizationId })
    .from(conversation)
    .where(
      and(
        eq(conversation.id, p.data.conversationId),
        eq(conversation.organizationId, org.id),
      ),
    )
    .limit(1);
  if (!conv) return { error: "conversation not found" };

  // Queue the message in DB and try to send immediately so the agent sees a
  // result. (Worker also drains if the sync send fails w/ a rate-limit.)
  const res = await queueOutboundMessage(
    {
      organizationId: org.id,
      conversationId: conv.id,
      sentByUserId: userId,
      sentByBot: false,
      body: p.data.body,
      templateId: p.data.templateId,
      templateVariables: p.data.templateVariables,
    },
    { sendNow: true },
  );
  if (res.status === "failed") {
    return { error: res.error ?? "send failed" };
  }
  if (res.status === "queued" && res.messageId) {
    // rate-limited; worker will pick up
    const job: OutboundSendJob = {
      organizationId: org.id,
      conversationId: conv.id,
      messageId: res.messageId,
      templateId: p.data.templateId,
      templateVariables: p.data.templateVariables,
    };
    await enqueue(QUEUES.outboundSend, job, {
      jobId: `out:${res.messageId}`,
      delay: 1200,
    });
  }
  revalidatePath(`/app/${p.data.orgSlug}/inbox`);
  return { ok: true, messageId: res.messageId };
}

export async function setConversationModeAction(input: {
  orgSlug: string;
  conversationId: string;
  mode: "bot" | "human";
}): Promise<{ ok: true } | { error: string }> {
  const { org, userId } = await requireAccess(input.orgSlug);
  await db
    .update(conversation)
    .set({
      mode: input.mode,
      assigneeUserId: input.mode === "human" ? userId : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversation.id, input.conversationId),
        eq(conversation.organizationId, org.id),
      ),
    );
  revalidatePath(`/app/${input.orgSlug}/inbox`);
  return { ok: true };
}

/** Reset the per-conversation unread counter after the agent opens the thread. */
export async function markConversationReadAction(input: {
  orgSlug: string;
  conversationId: string;
}): Promise<{ ok: true } | { error: string }> {
  const { org } = await requireAccess(input.orgSlug);
  await db
    .update(conversation)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(
      and(
        eq(conversation.id, input.conversationId),
        eq(conversation.organizationId, org.id),
      ),
    );
  return { ok: true };
}

/** Change conversation status (open / snoozed / closed). */
export async function setConversationStatusAction(input: {
  orgSlug: string;
  conversationId: string;
  status: "open" | "snoozed" | "closed";
}): Promise<{ ok: true } | { error: string }> {
  const { org } = await requireAccess(input.orgSlug);
  await db
    .update(conversation)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(
        eq(conversation.id, input.conversationId),
        eq(conversation.organizationId, org.id),
      ),
    );
  revalidatePath(`/app/${input.orgSlug}/inbox`);
  return { ok: true };
}

/**
 * Wipe all messages on a conversation so the agent can reset the bot's
 * memory for this customer. The conversation row stays (phone, channel,
 * mode) so future messages still route here; only history is deleted.
 */
export async function clearConversationHistoryAction(input: {
  orgSlug: string;
  conversationId: string;
}): Promise<{ ok: true } | { error: string }> {
  const { org } = await requireAccess(input.orgSlug);
  const [conv] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        eq(conversation.id, input.conversationId),
        eq(conversation.organizationId, org.id),
      ),
    )
    .limit(1);
  if (!conv) return { error: "Conversation not found." };
  await db.delete(message).where(eq(message.conversationId, conv.id));
  await db
    .update(conversation)
    .set({
      lastMessagePreview: null,
      lastMessageAt: null,
      lastInboundAt: null,
      unreadCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(conversation.id, conv.id));
  revalidatePath(`/app/${input.orgSlug}/inbox`);
  return { ok: true };
}

/** Remove the entire conversation (and its messages). */
export async function deleteConversationAction(input: {
  orgSlug: string;
  conversationId: string;
}): Promise<{ ok: true } | { error: string }> {
  const { org } = await requireAccess(input.orgSlug);
  await db
    .delete(conversation)
    .where(
      and(
        eq(conversation.id, input.conversationId),
        eq(conversation.organizationId, org.id),
      ),
    );
  revalidatePath(`/app/${input.orgSlug}/inbox`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel connections
// ─────────────────────────────────────────────────────────────────────────────

const connectChannelSchema = z.object({
  orgSlug: z.string(),
  channel: z.enum(["whatsapp", "instagram", "messenger"]),
  provider: z.enum(["ycloud", "manychat", "meta", "syrow"]),
  label: z.string().optional(),
  externalId: z.string().optional(),
  config: z.record(z.unknown()).default({}),
  secrets: z.record(z.string()),
});

export async function connectChannelAction(
  raw: z.infer<typeof connectChannelSchema>,
): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    const p = connectChannelSchema.safeParse(raw);
    if (!p.success) {
      return { error: p.error.issues.map((i) => i.message).join(", ") };
    }
    const gate = await requireOrgIntegrationWrite(p.data.orgSlug);
    if (!gate.ok) return { error: gate.error };
    const { org } = gate;

    const id = randomUUID();
    const mergedConfig: Record<string, unknown> = { ...p.data.config };

    const secretsForStorage: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.data.secrets)) {
      secretsForStorage[k] = typeof v === "string" ? v.trim() : String(v ?? "");
    }

    if (p.data.provider === "meta" && p.data.channel === "instagram") {
      const appId = String(mergedConfig.instagramAppId ?? "").trim();
      if (!appId) {
        return {
          error:
            "Instagram App ID is required (Meta → Settings → Basic → App ID, or the numeric Instagram App ID from API setup).",
        };
      }
    }
    if (p.data.provider === "meta" && p.data.channel === "messenger") {
      const appId = String(mergedConfig.facebookAppId ?? "").trim();
      if (!appId) {
        return {
          error: "Meta / Facebook App ID is required (Meta → Settings → Basic → App ID).",
        };
      }
      const pageId = String(mergedConfig.pageId ?? "").trim();
      if (!pageId) {
        return { error: "Facebook Page ID is required." };
      }
    }

    if (
      p.data.provider === "meta" &&
      p.data.channel === "instagram" &&
      !(String(mergedConfig.igUserId ?? "").trim())
    ) {
      const token = String(secretsForStorage.accessToken ?? "").trim();
      if (!token) {
        return { error: "Instagram requires an access token to auto-detect the Business Account ID." };
      }
      const resolved = await resolveInstagramBusinessUserId(token);
      if (!resolved) {
        return {
          error:
            "Could not auto-detect Instagram Business Account ID from your token. Paste the numeric ID from Meta → Instagram → API setup (Instagram account row), or use a Page access token from a Page linked to Instagram.",
        };
      }
      mergedConfig.igUserId = resolved;
    }

    if (p.data.provider === "meta" && p.data.channel === "instagram") {
      const appSecret = secretsForStorage.appSecret ?? "";
      let token = secretsForStorage.accessToken ?? "";
      const appId = String(mergedConfig.instagramAppId ?? "").trim();
      const igBiz = String(mergedConfig.igUserId ?? "").trim();
      if (appId && appSecret && token) {
        const exchanged = await exchangeForLongLivedUserToken({
          appId,
          appSecret,
          shortLivedToken: token,
        });
        if (exchanged?.accessToken && exchanged.accessToken.length > 20) {
          token = exchanged.accessToken.trim();
          secretsForStorage.accessToken = token;
        }
      }
      if (igBiz && token) {
        const pageTok = await resolveInstagramPageAccessToken(token, igBiz);
        if (pageTok) {
          secretsForStorage.accessToken = pageTok.trim();
          token = secretsForStorage.accessToken;
          mergedConfig.messagingGraph = "facebook";
        } else if (await probeInstagramLoginToken(secretsForStorage.accessToken)) {
          mergedConfig.messagingGraph = "instagram";
        } else {
          mergedConfig.messagingGraph = "facebook";
        }
        if (mergedConfig.messagingGraph === "facebook") {
          const prof = await fetchInstagramBusinessAccountProfile(token, igBiz);
          if (prof?.username) mergedConfig.instagramUsername = prof.username;
          if (prof?.name) mergedConfig.instagramBusinessName = prof.name;
        } else {
          const self = await fetchInstagramBusinessMeInstagramGraph(
            secretsForStorage.accessToken,
          );
          if (self?.username) mergedConfig.instagramUsername = self.username;
          if (self?.name) mergedConfig.instagramBusinessName = self.name;
        }
      }
    } else if (p.data.provider === "meta" && p.data.channel === "messenger") {
      const appSecret = secretsForStorage.appSecret ?? "";
      let token = secretsForStorage.accessToken ?? "";
      const appId = String(mergedConfig.facebookAppId ?? "").trim();
      const pageId = String(mergedConfig.pageId ?? "").trim();
      if (appId && appSecret && token) {
        const exchanged = await exchangeForLongLivedUserToken({
          appId,
          appSecret,
          shortLivedToken: token,
        });
        if (exchanged?.accessToken && exchanged.accessToken.length > 20) {
          token = exchanged.accessToken.trim();
          secretsForStorage.accessToken = token;
        }
      }
      if (pageId && token) {
        const pageName = await fetchMessengerPageName(token, pageId);
        if (pageName) mergedConfig.pageName = pageName;
      }
    }

    const autoLabel =
      p.data.provider === "meta" || p.data.provider === "ycloud" || p.data.provider === "syrow"
        ? formatBusinessChannelLabel({
            provider: p.data.provider,
            channel: p.data.channel,
            config: mergedConfig as Record<string, unknown>,
            externalId:
              (typeof mergedConfig.igUserId === "string" ? mergedConfig.igUserId : null) ??
              (typeof mergedConfig.pageId === "string" ? mergedConfig.pageId : null) ??
              null,
          })
        : null;

    let secretsCiphertext: string;
    try {
      secretsCiphertext = encryptJSON(secretsForStorage);
    } catch (e) {
      console.error("[connectChannel] encrypt failed:", e);
      return {
        error:
          "Encryption is not configured on the server (ENCRYPTION_KEY missing). Ask your platform admin to set it.",
      };
    }

    await db.insert(channelConnection).values({
      id,
      organizationId: org.id,
      channel: p.data.channel,
      provider: p.data.provider,
      label: (p.data.label ?? "").trim() || autoLabel || null,
      externalId:
        p.data.externalId ??
        (typeof mergedConfig.igUserId === "string" ? mergedConfig.igUserId : null) ??
        (typeof mergedConfig.pageId === "string" ? mergedConfig.pageId : null) ??
        null,
      config: mergedConfig,
      secretsCiphertext,
      webhookSecret: randomBytes(24).toString("hex"),
    });
    revalidatePath(`/app/${p.data.orgSlug}/channels`);
    return { ok: true, id };
  } catch (e) {
    console.error("[connectChannel] failed:", e);
    return {
      error:
        e instanceof Error ? e.message : "Failed to save channel connection.",
    };
  }
}

export async function deleteChannelAction(input: {
  orgSlug: string;
  id: string;
}): Promise<{ ok: true } | { error: string }> {
  const gate = await requireOrgIntegrationWrite(input.orgSlug);
  if (!gate.ok) return { error: gate.error };
  const { org } = gate;
  await db
    .delete(channelConnection)
    .where(
      and(
        eq(channelConnection.id, input.id),
        eq(channelConnection.organizationId, org.id),
      ),
    );
  revalidatePath(`/app/${input.orgSlug}/channels`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot config + FAQ
// ─────────────────────────────────────────────────────────────────────────────

const botConfigSchema = z.object({
  orgSlug: z.string(),
  enabled: z.boolean(),
  name: z.string().min(1).max(80),
  // Bumped to fit production-grade prompts (the Modern Motors persona /
  // system prompt is ~5–6 kB, full prompt with rules + product specs can
  // hit ~12 kB). Underlying Postgres column is unbounded TEXT so this is
  // purely a sanity guard.
  persona: z.string().max(4000).optional(),
  systemPrompt: z.string().max(20_000).optional(),
  escalationKeywords: z.string().max(1000).optional(),
  escalateOnLowConfidence: z.boolean(),
  confidenceThreshold: z.number().int().min(0).max(100),
  ragEnabled: z.boolean(),
  vectorStore: z.enum(["qdrant", "pinecone"]),
  temperatureX100: z.number().int().min(0).max(200),
  maxOutputTokens: z.number().int().min(50).max(4096),
});

export async function upsertBotConfigAction(
  raw: z.infer<typeof botConfigSchema>,
): Promise<{ ok: true } | { error: string }> {
  const p = botConfigSchema.safeParse(raw);
  if (!p.success) {
    // Return field-by-field validation errors so the user can see which
    // field is too long, missing, or out of range — not a generic
    // "invalid input".
    const issues = p.error.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    return { error: issues || "Invalid input" };
  }
  const gate = await requireOrgIntegrationWrite(p.data.orgSlug);
  if (!gate.ok) return { error: gate.error };
  const { org } = gate;

  const [existing] = await db
    .select({ id: botConfig.id })
    .from(botConfig)
    .where(eq(botConfig.organizationId, org.id))
    .limit(1);

  if (existing) {
    await db
      .update(botConfig)
      .set({
        enabled: p.data.enabled,
        name: p.data.name,
        persona: p.data.persona ?? null,
        systemPrompt: p.data.systemPrompt ?? null,
        escalationKeywords: p.data.escalationKeywords ?? "",
        escalateOnLowConfidence: p.data.escalateOnLowConfidence,
        confidenceThreshold: p.data.confidenceThreshold,
        ragEnabled: p.data.ragEnabled,
        vectorStore: p.data.vectorStore,
        temperatureX100: p.data.temperatureX100,
        maxOutputTokens: p.data.maxOutputTokens,
        updatedAt: new Date(),
      })
      .where(eq(botConfig.id, existing.id));
  } else {
    await db.insert(botConfig).values({
      id: randomUUID(),
      organizationId: org.id,
      enabled: p.data.enabled,
      name: p.data.name,
      persona: p.data.persona ?? null,
      systemPrompt: p.data.systemPrompt ?? null,
      escalationKeywords: p.data.escalationKeywords ?? "",
      escalateOnLowConfidence: p.data.escalateOnLowConfidence,
      confidenceThreshold: p.data.confidenceThreshold,
      ragEnabled: p.data.ragEnabled,
      vectorStore: p.data.vectorStore,
      temperatureX100: p.data.temperatureX100,
      maxOutputTokens: p.data.maxOutputTokens,
    });
  }
  await invalidateBotConfigCache(org.id);
  revalidatePath(`/app/${p.data.orgSlug}/bot`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot voice / TTS / STT
// ─────────────────────────────────────────────────────────────────────────────

const botVoiceSchema = z.object({
  orgSlug: z.string(),
  voiceReplyEnabled: z.boolean(),
  voiceProvider: z.enum(["elevenlabs", "openai", "none"]).default("elevenlabs"),
  voiceVoiceId: z.string().nullable(),
  voiceModel: z.string().nullable(),
  /** null = keep existing secret. Empty string also treated as "keep". */
  voiceApiKey: z.string().nullable(),
  transcriptionProvider: z
    .enum(["groq", "openai", "elevenlabs"])
    .default("groq"),
  transcriptionLanguage: z.string().nullable(),
});

export async function upsertBotVoiceAction(
  raw: z.infer<typeof botVoiceSchema>,
): Promise<{ ok: true } | { error: string }> {
  try {
    const p = botVoiceSchema.safeParse(raw);
    if (!p.success) {
      const issues = p.error.issues
        .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
        .join("; ");
      return { error: issues || "Invalid input" };
    }
    const gate = await requireOrgIntegrationWrite(p.data.orgSlug);
    if (!gate.ok) return { error: gate.error };
    const { org } = gate;

    // Resolve the secret blob: keep existing if user passed null/empty,
    // otherwise re-encrypt with the new key.
    let secretsCiphertext: string | null | undefined;
    if (p.data.voiceApiKey && p.data.voiceApiKey.trim().length > 0) {
      try {
        secretsCiphertext = encryptJSON({ apiKey: p.data.voiceApiKey.trim() });
      } catch (e) {
        console.error("[upsertBotVoice] encrypt failed:", e);
        return {
          error:
            "Encryption is not configured on the server (ENCRYPTION_KEY missing).",
        };
      }
    } else {
      secretsCiphertext = undefined; // signal: keep existing
    }

    const [existing] = await db
      .select({ id: botConfig.id })
      .from(botConfig)
      .where(eq(botConfig.organizationId, org.id))
      .limit(1);

    const baseUpdate = {
      voiceReplyEnabled: p.data.voiceReplyEnabled,
      voiceProvider: p.data.voiceProvider,
      voiceVoiceId: p.data.voiceVoiceId,
      voiceModel: p.data.voiceModel,
      transcriptionProvider: p.data.transcriptionProvider,
      transcriptionLanguage: p.data.transcriptionLanguage,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(botConfig)
        .set(
          secretsCiphertext === undefined
            ? baseUpdate
            : { ...baseUpdate, voiceSecretsCiphertext: secretsCiphertext },
        )
        .where(eq(botConfig.id, existing.id));
    } else {
      // Create a minimal bot_config row if none exists yet.
      await db.insert(botConfig).values({
        id: randomUUID(),
        organizationId: org.id,
        ...baseUpdate,
        voiceSecretsCiphertext:
          secretsCiphertext === undefined ? null : secretsCiphertext,
      });
    }
    await invalidateBotConfigCache(org.id);
    revalidatePath(`/app/${p.data.orgSlug}/bot`);
    return { ok: true };
  } catch (e) {
    console.error("[upsertBotVoice] failed:", e);
    return {
      error: e instanceof Error ? e.message : "Failed to save voice settings.",
    };
  }
}

export async function addFaqAction(input: {
  orgSlug: string;
  question: string;
  answer: string;
}): Promise<{ ok: true } | { error: string }> {
  const gate = await requireOrgIntegrationWrite(input.orgSlug);
  if (!gate.ok) return { error: gate.error };
  const { org } = gate;
  if (!input.question.trim() || !input.answer.trim()) {
    return { error: "question and answer required" };
  }
  await db.insert(botFaq).values({
    id: randomUUID(),
    organizationId: org.id,
    question: input.question.trim(),
    answer: input.answer.trim(),
    enabled: true,
  });
  await invalidateBotConfigCache(org.id);
  revalidatePath(`/app/${input.orgSlug}/bot`);
  return { ok: true };
}

export async function deleteFaqAction(input: {
  orgSlug: string;
  id: string;
}): Promise<{ ok: true } | { error: string }> {
  const gate = await requireOrgIntegrationWrite(input.orgSlug);
  if (!gate.ok) return { error: gate.error };
  const { org } = gate;
  await db
    .delete(botFaq)
    .where(and(eq(botFaq.id, input.id), eq(botFaq.organizationId, org.id)));
  await invalidateBotConfigCache(org.id);
  revalidatePath(`/app/${input.orgSlug}/bot`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge base documents
// ─────────────────────────────────────────────────────────────────────────────

export async function createDocumentFromTextAction(input: {
  orgSlug: string;
  title: string;
  text: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const { org, userId } = await requireAccess(input.orgSlug);
  if (!input.title.trim() || !input.text.trim()) {
    return { error: "title and text required" };
  }
  const id = randomUUID();
  // For text docs we keep the raw text in `fileUrl` via a data: URL so the
  // ingest worker can re-use the same fetch path. (S3 upload happens via
  // presigned PUT in the separate /api/v1/documents route.)
  const fileUrl = `data:text/plain;base64,${Buffer.from(input.text, "utf8").toString("base64")}`;
  await db.insert(document).values({
    id,
    organizationId: org.id,
    title: input.title.slice(0, 200),
    source: "text",
    mimeType: "text/plain",
    sizeBytes: Buffer.byteLength(input.text, "utf8"),
    fileUrl,
    status: "pending",
    createdByUserId: userId,
  });
  const job: EmbedDocumentJob = {
    organizationId: org.id,
    documentId: id,
  };
  // Best-effort: if Redis is down the doc row is already saved as `pending` —
  // the worker will scan and pick it up on the next tick anyway.
  await safeEnqueue(QUEUES.embedDocument, job, { jobId: `doc:${id}` });
  revalidatePath(`/app/${input.orgSlug}/knowledge`);
  return { ok: true, id };
}

export async function deleteDocumentAction(input: {
  orgSlug: string;
  id: string;
}): Promise<{ ok: true } | { error: string }> {
  const { org } = await requireAccess(input.orgSlug);
  // Actual vector cleanup happens in the service; we fire-and-forget via a
  // lightweight import to avoid queue overhead for a single-doc delete.
  const { purgeDocument } = await import("@/lib/services/rag-ingest");
  try {
    await purgeDocument({ organizationId: org.id, documentId: input.id });
  } catch (e) {
    console.warn("[doc delete]", e);
  }
  revalidatePath(`/app/${input.orgSlug}/knowledge`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  orgSlug: z.string(),
  channel: z.enum(["whatsapp", "instagram", "messenger"]).default("whatsapp"),
  name: z
    .string()
    .min(3)
    .regex(/^[a-z0-9_]+$/, "lowercase, digits, underscore only"),
  language: z.string().min(2).max(8),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("UTILITY"),
  bodyPreview: z.string().min(1).max(1024),
  variables: z.array(z.string()).default([]),
});

export async function upsertTemplateAction(
  raw: z.infer<typeof createTemplateSchema>,
): Promise<{ ok: true; id: string } | { error: string }> {
  const p = createTemplateSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues.map((i) => i.message).join(", ") };
  const { org } = await requireAccess(p.data.orgSlug);

  const [existing] = await db
    .select({ id: template.id })
    .from(template)
    .where(
      and(
        eq(template.organizationId, org.id),
        eq(template.name, p.data.name),
        eq(template.language, p.data.language),
      ),
    )
    .limit(1);

  const now = new Date();
  if (existing) {
    await db
      .update(template)
      .set({
        channel: p.data.channel,
        category: p.data.category,
        bodyPreview: p.data.bodyPreview,
        variables: p.data.variables,
        updatedAt: now,
      })
      .where(eq(template.id, existing.id));
    revalidatePath(`/app/${p.data.orgSlug}/templates`);
    return { ok: true, id: existing.id };
  }
  const id = randomUUID();
  await db.insert(template).values({
    id,
    organizationId: org.id,
    channel: p.data.channel,
    name: p.data.name,
    language: p.data.language,
    category: p.data.category,
    status: "draft",
    bodyPreview: p.data.bodyPreview,
    variables: p.data.variables,
  });
  revalidatePath(`/app/${p.data.orgSlug}/templates`);
  return { ok: true, id };
}

/** Admins/owners can mark a template approved after Meta/YCloud approval. */
export async function setTemplateStatusAction(input: {
  orgSlug: string;
  id: string;
  status: "draft" | "pending" | "approved" | "rejected";
}): Promise<{ ok: true } | { error: string }> {
  const { org } = await requireAccess(input.orgSlug);
  await db
    .update(template)
    .set({ status: input.status, updatedAt: new Date() })
    .where(and(eq(template.id, input.id), eq(template.organizationId, org.id)));
  revalidatePath(`/app/${input.orgSlug}/templates`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled template send (one-off to a specific customer)
// ─────────────────────────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  orgSlug: z.string(),
  customerId: z.string(),
  templateId: z.string(),
  variables: z.record(z.string()).default({}),
  runAt: z.string(), // ISO
  channel: z.enum(["whatsapp", "instagram", "messenger"]).default("whatsapp"),
  channelConnectionId: z.string().optional(),
});

export async function scheduleTemplateAction(
  raw: z.infer<typeof scheduleSchema>,
): Promise<{ ok: true; id: string } | { error: string }> {
  const p = scheduleSchema.safeParse(raw);
  if (!p.success) {
    const issues = p.error.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    return { error: issues || "Invalid input" };
  }
  const { org, userId } = await requireAccess(p.data.orgSlug);

  const runAt = new Date(p.data.runAt);
  if (Number.isNaN(runAt.getTime())) return { error: "invalid runAt" };
  if (runAt.getTime() < Date.now() - 60_000) {
    return { error: "runAt is in the past" };
  }

  const [cust] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(eq(customer.id, p.data.customerId), eq(customer.organizationId, org.id)),
    )
    .limit(1);
  if (!cust) return { error: "customer not found" };

  const [tpl] = await db
    .select({ id: template.id, status: template.status })
    .from(template)
    .where(and(eq(template.id, p.data.templateId), eq(template.organizationId, org.id)))
    .limit(1);
  if (!tpl) return { error: "template not found" };
  if (tpl.status !== "approved") return { error: "template not approved" };

  const id = randomUUID();
  await db.insert(scheduledMessage).values({
    id,
    organizationId: org.id,
    customerId: cust.id,
    channel: p.data.channel,
    channelConnectionId: p.data.channelConnectionId ?? null,
    templateId: tpl.id,
    variables: p.data.variables,
    runAt,
    status: "queued",
    createdByUserId: userId,
  });
  revalidatePath(`/app/${p.data.orgSlug}/inbox`);
  return { ok: true, id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Broadcasts
// ─────────────────────────────────────────────────────────────────────────────

const broadcastSchema = z.object({
  orgSlug: z.string(),
  name: z.string().min(1).max(120),
  templateId: z.string(),
  channel: z.enum(["whatsapp"]).default("whatsapp"),
  channelConnectionId: z.string().optional(),
  defaultVariables: z.record(z.string()).default({}),
  audienceTags: z.array(z.string()).default([]),
  audienceStatuses: z.array(z.string()).default([]),
  audienceLimit: z.number().int().min(1).max(100000).optional(),
  runNow: z.boolean().default(false),
  scheduledFor: z.string().optional(),
});

export async function createBroadcastAction(
  raw: z.infer<typeof broadcastSchema>,
): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    const p = broadcastSchema.safeParse(raw);
    if (!p.success) {
      return {
        error: p.error.issues
          .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
          .join("; "),
      };
    }
    const { org, userId } = await requireAccess(p.data.orgSlug);

    const [tpl] = await db
      .select({ id: template.id, status: template.status })
      .from(template)
      .where(
        and(eq(template.id, p.data.templateId), eq(template.organizationId, org.id)),
      )
      .limit(1);
    if (!tpl) return { error: "Template not found" };
    if (tpl.status !== "approved")
      return { error: "Template is not yet approved" };

    // Three modes:
    //   - runNow=true  → status="scheduled", enqueue worker immediately
    //   - scheduledFor → status="scheduled", scheduledFor=<future ts>,
    //                    slow-tick will dispatch when due
    //   - default      → status="draft", run manually later
    const scheduledForDate = p.data.scheduledFor
      ? new Date(p.data.scheduledFor)
      : null;
    if (scheduledForDate && Number.isNaN(scheduledForDate.getTime())) {
      return { error: "Invalid scheduledFor — use ISO 8601" };
    }

    const status = p.data.runNow
      ? "scheduled"
      : scheduledForDate
        ? "scheduled"
        : "draft";

    const id = randomUUID();
    await db.insert(broadcast).values({
      id,
      organizationId: org.id,
      name: p.data.name,
      channel: p.data.channel,
      templateId: tpl.id,
      channelConnectionId: p.data.channelConnectionId ?? null,
      audience: {
        tags: p.data.audienceTags,
        statuses: p.data.audienceStatuses,
        limit: p.data.audienceLimit,
      },
      defaultVariables: p.data.defaultVariables,
      status,
      scheduledFor: scheduledForDate,
      createdByUserId: userId,
    });

    if (p.data.runNow) {
      const job: BroadcastRunnerJob = {
        organizationId: org.id,
        broadcastId: id,
      };
      await safeEnqueue(QUEUES.broadcastRunner, job, { jobId: `bc_${id}` });
    }
    revalidatePath(`/app/${p.data.orgSlug}/broadcasts`);
    return { ok: true, id };
  } catch (e) {
    console.error("[createBroadcast] failed:", e);
    return {
      error: e instanceof Error ? e.message : "Failed to create broadcast.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// exported utility for UI: list recent messages in a conversation
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchConversationMessages(input: {
  orgSlug: string;
  conversationId: string;
  limit?: number;
}) {
  const { org } = await requireAccess(input.orgSlug);
  const limit = Math.min(input.limit ?? 100, 500);
  return db
    .select()
    .from(message)
    .where(
      and(
        eq(message.conversationId, input.conversationId),
        eq(message.organizationId, org.id),
      ),
    )
    .orderBy(message.createdAt)
    .limit(limit);
}
