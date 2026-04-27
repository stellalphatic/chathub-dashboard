import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botConfig, botFaq } from "@/db/schema";
import { assertOrgAdmin } from "@/lib/org-access";
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
  const { org } = await assertOrgAdmin(orgSlug);

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
          <FaqManager orgSlug={orgSlug} faqs={faqs} />
        </CardContent>
      </Card>
    </div>
  );
}
