"use client";

import { useState, useTransition } from "react";
import { upsertBotConfigAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BotConfigInput = {
  enabled: boolean;
  name: string;
  persona: string | null;
  systemPrompt: string | null;
  escalationKeywords: string | null;
  escalateOnLowConfidence: boolean;
  confidenceThreshold: number;
  ragEnabled: boolean;
  vectorStore: string;
  temperatureX100: number;
  maxOutputTokens: number;
};

export function BotConfigForm({
  orgSlug,
  initial,
}: {
  orgSlug: string;
  initial: BotConfigInput;
}) {
  const [form, setForm] = useState({
    ...initial,
    persona: initial.persona ?? "",
    systemPrompt: initial.systemPrompt ?? "",
    escalationKeywords: initial.escalationKeywords ?? "",
    vectorStore:
      (initial.vectorStore as "qdrant" | "pinecone") ?? "qdrant",
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        start(async () => {
          const res = await upsertBotConfigAction({
            orgSlug,
            enabled: form.enabled,
            name: form.name,
            persona: form.persona,
            systemPrompt: form.systemPrompt,
            escalationKeywords: form.escalationKeywords,
            escalateOnLowConfidence: form.escalateOnLowConfidence,
            confidenceThreshold: form.confidenceThreshold,
            ragEnabled: form.ragEnabled,
            vectorStore: form.vectorStore,
            temperatureX100: form.temperatureX100,
            maxOutputTokens: form.maxOutputTokens,
          });
          if ("error" in res) setError(res.error);
          else setOk(true);
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
        />
        Bot enabled
      </label>

      <div>
        <Label>Bot display name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div>
        <Label>Persona (1-2 sentences)</Label>
        <textarea
          rows={2}
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={form.persona}
          onChange={(e) => setForm({ ...form, persona: e.target.value })}
          placeholder="Friendly, concise, never pushy."
        />
      </div>

      <div>
        <Label>System prompt</Label>
        <textarea
          rows={6}
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white font-mono"
          value={form.systemPrompt}
          onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
          placeholder="You are Customer Support for ACME. Answer briefly. When unsure say so and offer a human."
        />
      </div>

      <div>
        <Label>Escalation keywords (comma-separated)</Label>
        <Input
          value={form.escalationKeywords}
          onChange={(e) =>
            setForm({ ...form, escalationKeywords: e.target.value })
          }
          placeholder="human,agent,refund,cancel"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="text-sm">
          Temperature
          <Input
            type="number"
            min={0}
            max={200}
            value={form.temperatureX100}
            onChange={(e) =>
              setForm({ ...form, temperatureX100: Number(e.target.value) })
            }
          />
          <span className="mt-1 block text-xs text-zinc-500">
            {form.temperatureX100 / 100}
          </span>
        </label>
        <label className="text-sm">
          Max output tokens
          <Input
            type="number"
            min={50}
            max={2048}
            value={form.maxOutputTokens}
            onChange={(e) =>
              setForm({ ...form, maxOutputTokens: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-sm">
          Confidence threshold
          <Input
            type="number"
            min={0}
            max={100}
            value={form.confidenceThreshold}
            onChange={(e) =>
              setForm({ ...form, confidenceThreshold: Number(e.target.value) })
            }
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.escalateOnLowConfidence}
          onChange={(e) =>
            setForm({ ...form, escalateOnLowConfidence: e.target.checked })
          }
        />
        Escalate to human on low-confidence answers
      </label>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ragEnabled}
            onChange={(e) => setForm({ ...form, ragEnabled: e.target.checked })}
          />
          Enable RAG (retrieve from uploaded documents)
        </label>
        {form.ragEnabled && (
          <div>
            <Label>Vector store</Label>
            <select
              value={form.vectorStore}
              onChange={(e) =>
                setForm({
                  ...form,
                  vectorStore: e.target.value as "qdrant" | "pinecone",
                })
              }
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              <option value="qdrant">Qdrant (self-hosted, default)</option>
              <option value="pinecone">Pinecone (managed)</option>
            </select>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {ok && !error && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save bot config"}
      </Button>
    </form>
  );
}
