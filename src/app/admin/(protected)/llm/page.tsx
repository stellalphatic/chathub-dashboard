import { asc } from "drizzle-orm";
import { Cpu } from "lucide-react";
import { db } from "@/db";
import { platformLlmCredential } from "@/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LlmCredentialForm } from "./llm-credential-form";

type ProviderDef = {
  key: "groq" | "gemini" | "openai";
  title: string;
  defaultModel: string;
  priority: number;
  blurb: string;
};

const PROVIDERS: ProviderDef[] = [
  {
    key: "groq",
    title: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    priority: 10,
    blurb: "Cheapest + fastest for everyday replies. Free tier available.",
  },
  {
    key: "gemini",
    title: "Google Gemini",
    defaultModel: "gemini-1.5-flash",
    priority: 20,
    blurb: "Strong multimodal + embeddings. Use when Groq rate-limits.",
  },
  {
    key: "openai",
    title: "OpenAI",
    defaultModel: "gpt-4o-mini",
    priority: 30,
    blurb: "Highest-quality fallback. Used last because it's the most expensive.",
  },
];

export default async function LlmAdminPage() {
  const rows = await db
    .select({
      provider: platformLlmCredential.provider,
      enabled: platformLlmCredential.enabled,
      defaultModel: platformLlmCredential.defaultModel,
      priority: platformLlmCredential.priority,
      updatedAt: platformLlmCredential.updatedAt,
    })
    .from(platformLlmCredential)
    .orderBy(asc(platformLlmCredential.priority));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LLM providers</h1>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          Keys are AES-256-GCM encrypted with <code>ENCRYPTION_KEY</code>. The router tries
          providers in ascending priority order. Default cascade: Groq → Gemini → OpenAI.
        </p>
      </div>

      <div className="stagger grid gap-4 lg:grid-cols-2">
        {PROVIDERS.map((p) => {
          const existing = rows.find((r) => r.provider === p.key);
          const state = existing?.enabled
            ? ("success" as const)
            : existing
              ? ("secondary" as const)
              : ("warning" as const);
          const stateLabel = existing
            ? existing.enabled
              ? "Active"
              : "Disabled"
            : "Not set";
          return (
            <Card key={p.key} className="fade-up-item card-hover">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div>
                      <CardTitle>{p.title}</CardTitle>
                      <CardDescription className="font-mono text-[11px]">
                        priority {existing?.priority ?? p.priority} · {existing?.defaultModel ?? p.defaultModel}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={state}>{stateLabel}</Badge>
                </div>
                <p className="mt-3 text-xs text-[rgb(var(--fg-muted))]">{p.blurb}</p>
              </CardHeader>
              <CardContent>
                <LlmCredentialForm
                  provider={p.key}
                  initial={{
                    enabled: existing?.enabled ?? true,
                    defaultModel: existing?.defaultModel ?? p.defaultModel,
                    priority: existing?.priority ?? p.priority,
                  }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
