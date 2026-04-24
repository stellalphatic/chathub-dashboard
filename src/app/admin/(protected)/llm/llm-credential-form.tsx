"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  deleteLlmCredentialAction,
  testLlmCredentialAction,
  toggleLlmCredentialAction,
  upsertLlmCredentialAction,
} from "@/app/admin/actions-llm";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<null | {
    ok: true;
    latencyMs: number;
    tokens: number;
    snippet: string;
    model: string;
  }>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await upsertLlmCredentialAction({
            provider,
            enabled,
            defaultModel,
            apiKey,
            priority,
          });
          if ("error" in res) {
            toast.error(res.error);
          } else {
            toast.success("Provider saved.");
            setApiKey("");
          }
        });
      }}
    >
      <Switch
        checked={enabled}
        onCheckedChange={(v) => {
          setEnabled(v);
          start(async () => {
            const res = await toggleLlmCredentialAction({ provider, enabled: v });
            if (res && "error" in res && res.error) toast.error(res.error);
          });
        }}
        label={enabled ? "Enabled — in router cascade" : "Disabled"}
        description="Turn off to skip this provider without deleting the key."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Default model</Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
          />
        </div>
        <div>
          <Label>Priority (lower = tried first)</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            max={1000}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>API key (write-only)</Label>
        <Input
          className="mt-1"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste key — encrypted with ENCRYPTION_KEY before storage"
        />
        <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
          The key is never read back from the DB. Re-enter to rotate.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="gradient" disabled={pending}>
          {pending ? "Saving…" : "Save provider"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={testing}
          onClick={() => {
            setTestResult(null);
            startTest(async () => {
              const res = await testLlmCredentialAction({ provider });
              if ("error" in res) {
                toast.error(res.error);
              } else {
                setTestResult(res);
                toast.success(`${provider} reachable in ${res.latencyMs}ms`);
              }
            });
          }}
        >
          {testing ? <>Testing…</> : <><Zap className="h-3.5 w-3.5" /> Test call</>}
        </Button>
        <ConfirmButton
          title="Delete credential?"
          description={`This removes ${provider}'s key from the router. Messages will fall through to the next provider.`}
          confirmLabel="Delete key"
          successToast="Credential removed."
          action={async () => {
            const res = await deleteLlmCredentialAction({ provider });
            return res;
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </ConfirmButton>
      </div>

      {testResult ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Test successful · {testResult.latencyMs}ms · {testResult.tokens} tokens · model{" "}
            <code>{testResult.model}</code>
          </div>
          {testResult.snippet ? (
            <p className="mt-1 text-[rgb(var(--fg-muted))]">
              Sample reply: <span className="text-[rgb(var(--fg))]">{testResult.snippet}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
