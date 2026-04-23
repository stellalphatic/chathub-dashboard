"use client";

import { useState, useTransition } from "react";
import {
  deleteLlmCredentialAction,
  toggleLlmCredentialAction,
  upsertLlmCredentialAction,
} from "@/app/admin/actions-llm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LlmCredentialForm({
  provider,
  initial,
}: {
  provider: "groq" | "gemini" | "openai";
  initial: { enabled: boolean; defaultModel: string; priority: number };
}) {
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState(initial.defaultModel);
  const [priority, setPriority] = useState(initial.priority);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        setOk(false);
        start(async () => {
          const res = await upsertLlmCredentialAction({
            provider,
            enabled,
            defaultModel,
            apiKey,
            priority,
          });
          if ("error" in res) setErr(res.error);
          else {
            setOk(true);
            setApiKey("");
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>Default model</Label>
          <Input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
          />
        </div>
        <div>
          <Label>Priority (lower = earlier)</Label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Enabled</Label>
          <label className="mt-3 block text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mr-2"
            />
            {enabled ? "yes" : "no"}
          </label>
        </div>
      </div>
      <div>
        <Label>API key (write-only)</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="paste key; it will be encrypted"
        />
      </div>
      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      )}
      {ok && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Saved.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await toggleLlmCredentialAction({ provider, enabled: !enabled });
              setEnabled(!enabled);
            });
          }}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
        >
          {enabled ? "Disable" : "Enable"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete credential?")) return;
            start(async () => {
              await deleteLlmCredentialAction({ provider });
            });
          }}
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
        >
          Delete
        </button>
      </div>
    </form>
  );
}
