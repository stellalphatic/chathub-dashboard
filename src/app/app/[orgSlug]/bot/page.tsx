import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botConfig, botFaq } from "@/db/schema";
import { assertOrgPage } from "@/lib/org-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BotConfigForm } from "@/components/bot/bot-config-form";
import { FaqManager } from "@/components/bot/faq-manager";

export default async function BotPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await assertOrgPage(orgSlug, "bot", "view");
  const { org } = access;
  const readOnly = !access.permissions.bot.edit;

  const [cfg] = await db
    .select()
    .from(botConfig)
    .where(eq(botConfig.organizationId, org.id))
    .limit(1);

  const faqs = await db
    .select()
    .from(botFaq)
    .where(eq(botFaq.organizationId, org.id));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Bot & guardrails</h2>
        <p className="text-sm text-zinc-400">
          Configure persona, escalation rules, and RAG. Groq → Gemini → OpenAI
          is the default fallback chain.
        </p>
        {readOnly ? (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            View-only: your role can&apos;t edit bot settings. Ask an owner or admin for editor
            access.
          </p>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Assistant configuration</CardTitle>
          <CardDescription>
            The system prompt is combined with the retrieved RAG context when
            answering customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BotConfigForm
            orgSlug={orgSlug}
            readOnly={readOnly}
            initial={
              cfg
                ? {
                    enabled: cfg.enabled,
                    name: cfg.name,
                    persona: cfg.persona,
                    systemPrompt: cfg.systemPrompt,
                    escalationKeywords: cfg.escalationKeywords,
                    escalateOnLowConfidence: cfg.escalateOnLowConfidence,
                    confidenceThreshold: cfg.confidenceThreshold,
                    ragEnabled: cfg.ragEnabled,
                    vectorStore: cfg.vectorStore,
                    temperatureX100: cfg.temperatureX100,
                    maxOutputTokens: cfg.maxOutputTokens,
                    voiceReplyEnabled: cfg.voiceReplyEnabled,
                    voiceProvider: cfg.voiceProvider,
                    voiceVoiceId: cfg.voiceVoiceId,
                    voiceModel: cfg.voiceModel,
                    // Don't ship the ciphertext — only whether it exists.
                    voiceApiKeySet: Boolean(cfg.voiceSecretsCiphertext),
                    transcriptionProvider: cfg.transcriptionProvider,
                    transcriptionLanguage: cfg.transcriptionLanguage,
                  }
                : {
                    enabled: true,
                    name: "Assistant",
                    persona: "",
                    systemPrompt: "",
                    escalationKeywords: "human,agent,representative,refund,cancel",
                    escalateOnLowConfidence: true,
                    confidenceThreshold: 55,
                    ragEnabled: false,
                    vectorStore: "qdrant",
                    temperatureX100: 30,
                    maxOutputTokens: 400,
                    voiceReplyEnabled: false,
                    voiceProvider: "elevenlabs",
                    voiceVoiceId: null,
                    voiceModel: null,
                    voiceApiKeySet: false,
                    transcriptionProvider: "groq",
                    transcriptionLanguage: "ur",
                  }
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>FAQs</CardTitle>
          <CardDescription>
            Exact / near-match hot-path. Checked before the LLM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FaqManager orgSlug={orgSlug} faqs={faqs} readOnly={readOnly} />
        </CardContent>
      </Card>
    </div>
  );
}
