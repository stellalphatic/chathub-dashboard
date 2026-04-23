"use client";

import { useMemo, useState, useTransition } from "react";
import { sendMessageAction } from "@/lib/org-actions";
import { decideSend } from "@/lib/window-24h";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  language: string;
  bodyPreview: string;
  variables: string[];
};

export function Composer({
  orgSlug,
  conversationId,
  channel,
  lastInboundAt,
  templates,
}: {
  orgSlug: string;
  conversationId: string;
  channel: string;
  lastInboundAt: Date | null;
  templates: Template[];
}) {
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"freeform" | "template">("freeform");
  const [templateId, setTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decision = useMemo(
    () => decideSend(channel, lastInboundAt),
    [channel, lastInboundAt],
  );
  const mustUseTemplate = decision.kind === "template_required";
  const selectedTemplate = templates.find((t) => t.id === templateId);

  // Auto-flip to template mode when the window has closed.
  const effectiveMode = mustUseTemplate ? "template" : mode;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    start(async () => {
      if (effectiveMode === "template") {
        if (!templateId) {
          setError("Pick an approved template.");
          return;
        }
        const res = await sendMessageAction({
          orgSlug,
          conversationId,
          templateId,
          templateVariables: variables,
        });
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setTemplateId("");
        setVariables({});
      } else {
        if (!body.trim()) {
          setError("Message can't be empty.");
          return;
        }
        const res = await sendMessageAction({
          orgSlug,
          conversationId,
          body: body.trim(),
        });
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setBody("");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-white/10 bg-zinc-950/40 px-3 py-3 space-y-2"
    >
      {mustUseTemplate && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          The 24-hour customer service window is closed. You must send an
          approved template; freeform is not allowed.
        </p>
      )}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          disabled={mustUseTemplate}
          onClick={() => setMode("freeform")}
          className={cn(
            "rounded-full px-3 py-1",
            effectiveMode === "freeform"
              ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
              : "bg-white/5 text-zinc-400",
            mustUseTemplate && "cursor-not-allowed opacity-50",
          )}
        >
          Freeform
        </button>
        <button
          type="button"
          onClick={() => setMode("template")}
          className={cn(
            "rounded-full px-3 py-1",
            effectiveMode === "template"
              ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
              : "bg-white/5 text-zinc-400",
          )}
        >
          Template
        </button>
      </div>

      {effectiveMode === "template" ? (
        <div className="space-y-2">
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setVariables({});
            }}
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Pick an approved template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <>
              <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300">
                {selectedTemplate.bodyPreview}
              </p>
              {(selectedTemplate.variables ?? []).length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(selectedTemplate.variables ?? []).map((v) => (
                    <input
                      key={v}
                      value={variables[v] ?? ""}
                      onChange={(e) =>
                        setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      placeholder={`{{${v}}}`}
                      className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          rows={2}
          className="w-full resize-none rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />
      )}

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-9 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
