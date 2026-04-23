import { asc } from "drizzle-orm";
import { db } from "@/db";
import { platformLlmCredential } from "@/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LlmCredentialForm } from "./llm-credential-form";

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

  const providers: Array<{
    key: "groq" | "gemini" | "openai";
    title: string;
    defaultModel: string;
    priority: number;
  }> = [
    { key: "groq", title: "Groq", defaultModel: "llama-3.3-70b-versatile", priority: 10 },
    { key: "gemini", title: "Gemini", defaultModel: "gemini-1.5-flash", priority: 20 },
    { key: "openai", title: "OpenAI", defaultModel: "gpt-4o-mini", priority: 30 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">LLM providers</h1>
        <p className="text-sm text-zinc-400">
          Keys are encrypted with AES-GCM using <code>ENCRYPTION_KEY</code>.
          The router tries providers in ascending priority order. Groq → Gemini → OpenAI is the default.
        </p>
      </div>

      {providers.map((p) => {
        const existing = rows.find((r) => r.provider === p.key);
        return (
          <Card key={p.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{p.title}</span>
                <span
                  className={
                    existing?.enabled
                      ? "rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                      : existing
                        ? "rounded bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-300"
                        : "rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-300"
                  }
                >
                  {existing ? (existing.enabled ? "enabled" : "disabled") : "not set"}
                </span>
              </CardTitle>
              <CardDescription>
                Priority {existing?.priority ?? p.priority} · default model{" "}
                <code className="text-emerald-400">
                  {existing?.defaultModel ?? p.defaultModel}
                </code>
              </CardDescription>
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
  );
}
