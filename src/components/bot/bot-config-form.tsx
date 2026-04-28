"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Bot,
  CheckCircle2,
  Mic,
  MessageSquareHeart,
  ShieldAlert,
  Sliders,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { upsertBotConfigAction, upsertBotVoiceAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

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
  // Voice / TTS / transcription
  voiceReplyEnabled?: boolean;
  voiceProvider?: string | null;
  voiceVoiceId?: string | null;
  voiceModel?: string | null;
  voiceApiKeySet?: boolean; // server-only: just tells UI whether a secret exists
  transcriptionProvider?: string | null;
  transcriptionLanguage?: string | null;
};

const TONE_PRESETS = [
  { id: "friendly", label: "Friendly", sample: "Warm, helpful, uses first names." },
  { id: "professional", label: "Professional", sample: "Polite, precise, no slang." },
  { id: "concise", label: "Concise", sample: "Short sentences, minimum fluff." },
  { id: "playful", label: "Playful", sample: "Light humour and occasional emoji." },
];

// Render a list of tag chips editor
function ChipList({
  items,
  onChange,
  placeholder,
  color,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  color: "emerald" | "rose" | "amber";
}) {
  const [draft, setDraft] = useState("");
  const colorCls =
    color === "emerald"
      ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border-emerald-500/20"
      : color === "rose"
        ? "bg-rose-500/12 text-rose-600 dark:text-rose-300 border-rose-500/20"
        : "bg-amber-500/12 text-amber-600 dark:text-amber-300 border-amber-500/20";

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-[rgb(var(--fg-subtle))]">
            None yet — add some below.
          </span>
        ) : (
          items.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${colorCls}`}
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="ml-0.5 rounded-full hover:bg-black/10"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

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
    vectorStore: (initial.vectorStore as "qdrant" | "pinecone") ?? "qdrant",
  });

  const [tone, setTone] = useState<string>(
    () => TONE_PRESETS.find((p) => initial.persona?.toLowerCase().startsWith(p.id))?.id ?? "professional",
  );
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  // Live composed system prompt preview
  const composedPreview = useMemo(() => {
    const lines: string[] = [];
    if (form.systemPrompt.trim()) lines.push(form.systemPrompt.trim());
    if (tone) {
      const t = TONE_PRESETS.find((p) => p.id === tone);
      if (t) lines.push(`Tone: ${t.label}. ${t.sample}`);
    }
    if (dos.length) lines.push(`ALWAYS:\n${dos.map((d) => `- ${d}`).join("\n")}`);
    if (donts.length) lines.push(`NEVER:\n${donts.map((d) => `- ${d}`).join("\n")}`);
    return lines.join("\n\n");
  }, [form.systemPrompt, tone, dos, donts]);

  const generateSystemPrompt = () => {
    if (!composedPreview) return;
    setForm({ ...form, systemPrompt: composedPreview });
    setOk(false);
  };

  return (
    <form
      className="space-y-6"
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
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <Switch
          id="bot-enabled"
          checked={form.enabled}
          onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          label={
            <span className="inline-flex items-center gap-2">
              <Bot className="h-4 w-4 text-[rgb(var(--accent))]" /> Bot enabled
            </span>
          }
          description="When off, inbound messages go straight to the human inbox."
        />
        <Badge variant={form.enabled ? "success" : "secondary"}>
          {form.enabled ? "Live" : "Paused"}
        </Badge>
      </div>

      <Tabs defaultValue="persona">
        <TabsList>
          <TabsTrigger value="persona">
            <Sparkles className="h-3.5 w-3.5" /> Persona
          </TabsTrigger>
          <TabsTrigger value="style">
            <MessageSquareHeart className="h-3.5 w-3.5" /> Style
          </TabsTrigger>
          <TabsTrigger value="prompt">
            <Bot className="h-3.5 w-3.5" /> System prompt
          </TabsTrigger>
          <TabsTrigger value="escalate">
            <ShieldAlert className="h-3.5 w-3.5" /> Escalation
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Sliders className="h-3.5 w-3.5" /> Advanced
          </TabsTrigger>
          <TabsTrigger value="voice">
            <Mic className="h-3.5 w-3.5" /> Voice
          </TabsTrigger>
        </TabsList>

        {/* Persona */}
        <TabsContent value="persona" className="space-y-5">
          <div>
            <Label>Bot display name</Label>
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Modern Motors Assistant"
            />
          </div>
          <div>
            <Label>Who is the bot, in 1–2 sentences?</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={form.persona}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
              placeholder="Friendly, concise, never pushy. Acts as a junior sales assistant for a used-car dealership in Karachi."
            />
          </div>
        </TabsContent>

        {/* Communication Style */}
        <TabsContent value="style" className="space-y-6">
          <div>
            <Label>Tone of voice</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TONE_PRESETS.map((t) => {
                const active = tone === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]"
                        : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-2))]"
                    }`}
                  >
                    <span className="text-sm font-medium text-[rgb(var(--fg))]">
                      {t.label}
                    </span>
                    <span className="text-xs text-[rgb(var(--fg-muted))]">{t.sample}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-emerald-600 dark:text-emerald-400">
              Do's — things the bot ALWAYS does
            </Label>
            <div className="mt-2">
              <ChipList
                items={dos}
                onChange={setDos}
                placeholder="e.g. Confirm booking times before agreeing"
                color="emerald"
              />
            </div>
          </div>

          <div>
            <Label className="text-rose-600 dark:text-rose-400">
              Don'ts — hard refusals, things the bot NEVER does
            </Label>
            <div className="mt-2">
              <ChipList
                items={donts}
                onChange={setDonts}
                placeholder="e.g. Never quote prices without checking inventory"
                color="rose"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                Preview
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={generateSystemPrompt}
                disabled={!composedPreview}
              >
                <Wand2 className="h-3.5 w-3.5" /> Push into system prompt
              </Button>
            </div>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-[rgb(var(--fg-muted))]">
{composedPreview || "Fill out tone / do's / don'ts to generate a composed prompt."}
            </pre>
          </div>
        </TabsContent>

        {/* System prompt */}
        <TabsContent value="prompt" className="space-y-4">
          <div>
            <Label>System prompt (what the LLM sees every turn)</Label>
            <Textarea
              className="mt-1 font-mono text-xs"
              rows={12}
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder="You are Customer Support for ACME. Answer briefly. When unsure, say so and offer a human."
            />
            <p className="mt-2 text-xs text-[rgb(var(--fg-subtle))]">
              Combine with tone + do's + don'ts from the Style tab, then click{" "}
              <strong>Push into system prompt</strong> to replace this text with the composed
              version.
            </p>
          </div>
        </TabsContent>

        {/* Escalation */}
        <TabsContent value="escalate" className="space-y-5">
          <div>
            <Label>Escalation keywords (comma-separated)</Label>
            <Input
              className="mt-1"
              value={form.escalationKeywords}
              onChange={(e) =>
                setForm({ ...form, escalationKeywords: e.target.value })
              }
              placeholder="human,agent,refund,cancel,complaint"
            />
            <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">
              When any keyword appears in a customer message, the bot stops and hands the
              thread to a human agent.
            </p>
          </div>

          <Switch
            checked={form.escalateOnLowConfidence}
            onCheckedChange={(v) =>
              setForm({ ...form, escalateOnLowConfidence: v })
            }
            label="Escalate on low-confidence answers"
            description="If the LLM isn't sure of its answer, defer to a human."
          />

          <div>
            <Label>
              Confidence threshold ({form.confidenceThreshold}%)
            </Label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.confidenceThreshold}
              onChange={(e) =>
                setForm({ ...form, confidenceThreshold: Number(e.target.value) })
              }
              className="mt-2 w-full accent-[rgb(var(--accent))]"
            />
            <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">
              Anything below this score is handed off.
            </p>
          </div>
        </TabsContent>

        {/* Advanced */}
        <TabsContent value="advanced" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Temperature ({(form.temperatureX100 / 100).toFixed(2)})</Label>
              <input
                type="range"
                min={0}
                max={200}
                value={form.temperatureX100}
                onChange={(e) =>
                  setForm({ ...form, temperatureX100: Number(e.target.value) })
                }
                className="mt-2 w-full accent-[rgb(var(--accent))]"
              />
              <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">
                Lower = more predictable. 0.3 is a safe default for support.
              </p>
            </div>
            <div>
              <Label>Max output tokens</Label>
              <Input
                type="number"
                min={50}
                max={2048}
                className="mt-1"
                value={form.maxOutputTokens}
                onChange={(e) =>
                  setForm({ ...form, maxOutputTokens: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
            <Switch
              checked={form.ragEnabled}
              onCheckedChange={(v) => setForm({ ...form, ragEnabled: v })}
              label="Enable RAG (retrieve from uploaded documents)"
              description="Bot answers ground in the Knowledge tab before responding."
            />
            {form.ragEnabled && (
              <div className="mt-4">
                <Label>Vector store</Label>
                <select
                  value={form.vectorStore}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      vectorStore: e.target.value as "qdrant" | "pinecone",
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
                >
                  <option value="qdrant">Qdrant (self-hosted, default)</option>
                  <option value="pinecone">Pinecone (managed)</option>
                </select>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Voice / TTS / Transcription */}
        <TabsContent value="voice" className="space-y-6">
          <VoiceTab orgSlug={orgSlug} initial={initial} />
        </TabsContent>
      </Tabs>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
      {ok && !error && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Saved. The cache refreshes within 60 seconds.
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" variant="gradient" disabled={pending}>
          {pending ? "Saving…" : "Save bot config"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Voice/TTS configuration. Saves independently from the main bot config so
 * the API key (a separate encrypted column) doesn't need to round-trip
 * through the rest of the form.
 *
 * Default behaviour: voiceReplyEnabled = false → reply with TEXT only,
 * exactly as before. Turning it on requires picking a provider AND saving
 * an API key; if any TTS call fails at runtime, the worker falls back to
 * text automatically (configured server-side).
 */
function VoiceTab({
  orgSlug,
  initial,
}: {
  orgSlug: string;
  initial: BotConfigInput;
}) {
  const [enabled, setEnabled] = useState<boolean>(
    Boolean(initial.voiceReplyEnabled),
  );
  const [provider, setProvider] = useState<string>(
    initial.voiceProvider ?? "elevenlabs",
  );
  const [voiceId, setVoiceId] = useState<string>(initial.voiceVoiceId ?? "");
  const [model, setModel] = useState<string>(
    initial.voiceModel ?? "eleven_turbo_v2",
  );
  const [apiKey, setApiKey] = useState<string>(""); // never pre-filled
  const [transProvider, setTransProvider] = useState<string>(
    initial.transcriptionProvider ?? "groq",
  );
  const [transLang, setTransLang] = useState<string>(
    initial.transcriptionLanguage ?? "auto",
  );
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setMsg(null);
    start(async () => {
      const res = await upsertBotVoiceAction({
        orgSlug,
        voiceReplyEnabled: enabled,
        voiceProvider: provider as "elevenlabs" | "openai" | "none",
        voiceVoiceId: voiceId.trim() || null,
        voiceModel: model.trim() || null,
        // Empty key → keep the existing one. Only send when user typed something.
        voiceApiKey: apiKey.trim() ? apiKey.trim() : null,
        transcriptionProvider: transProvider as
          | "groq"
          | "openai"
          | "elevenlabs",
        transcriptionLanguage: transLang.trim() || null,
      });
      if ("error" in res) setMsg({ err: res.error });
      else {
        setMsg({ ok: "Voice settings saved." });
        setApiKey(""); // clear secret from the input
      }
    });
  };

  return (
    <div className="space-y-6">
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        label="Reply with voice when the customer sent a voice note"
        description="Off by default. When off, the bot always replies with text — even for voice-note inbound."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>TTS provider</Label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
          >
            <option value="elevenlabs">ElevenLabs</option>
            <option value="openai">OpenAI TTS</option>
            <option value="none">None (text only)</option>
          </select>
        </div>
        <div>
          <Label>Voice ID / name</Label>
          <Input
            className="mt-1"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            placeholder={
              provider === "elevenlabs"
                ? "21m00Tcm4TlvDq8ikWAM"
                : provider === "openai"
                  ? "alloy"
                  : "—"
            }
          />
        </div>
        <div>
          <Label>Voice model</Label>
          <Input
            className="mt-1"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={
              provider === "elevenlabs"
                ? "eleven_turbo_v2"
                : provider === "openai"
                  ? "tts-1"
                  : "—"
            }
          />
        </div>
        <div>
          <Label>
            API key{" "}
            <span className="text-[11px] font-normal text-[rgb(var(--fg-subtle))]">
              {initial.voiceApiKeySet
                ? "(saved — leave blank to keep)"
                : "(required)"}
            </span>
          </Label>
          <Input
            className="mt-1 font-mono text-xs"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              initial.voiceApiKeySet ? "•••••••• (saved)" : "sk_..."
            }
            autoComplete="off"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
          Transcription (Speech-to-Text)
        </p>
        <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">
          Used when customers send voice notes. Falls back to the
          platform-wide GROQ_API_KEY if not set per business.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>STT provider</Label>
            <select
              value={transProvider}
              onChange={(e) => setTransProvider(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
            >
              <option value="groq">Groq Whisper (default — fastest, free tier)</option>
              <option value="elevenlabs">ElevenLabs Scribe (best for code-switched Urdu / Hindi / English)</option>
              <option value="openai">OpenAI Whisper</option>
            </select>
            <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
              ElevenLabs Scribe handles mixed-language speech naturally —
              ideal for customers who speak Urdu + English in the same
              sentence. Reuses the API key you saved above.
            </p>
          </div>
          <div>
            <Label>Preferred language</Label>
            <select
              value={transLang}
              onChange={(e) => setTransLang(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
            >
              <option value="auto">Auto-detect (recommended)</option>
              <option value="ur">Urdu</option>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
            <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
              Auto-detect lets the provider figure out the language per
              clip. Forcing a language only helps when you know everyone
              speaks the same one.
            </p>
          </div>
        </div>
      </div>

      {msg?.err && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {msg.err}
        </p>
      )}
      {msg?.ok && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> {msg.ok}
        </p>
      )}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="gradient"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Saving…" : "Save voice settings"}
        </Button>
      </div>
    </div>
  );
}
