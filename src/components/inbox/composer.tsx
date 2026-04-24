"use client";

import { useMemo, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendMessageAction } from "@/lib/org-actions";
import { decideSend } from "@/lib/window-24h";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const [pending, start] = useTransition();

  const decision = useMemo(
    () => decideSend(channel, lastInboundAt),
    [channel, lastInboundAt],
  );
  const mustUseTemplate = decision.kind === "template_required";
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const effectiveMode = mustUseTemplate ? "template" : mode;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      if (effectiveMode === "template") {
        if (!templateId) {
          toast.error("Pick an approved template first.");
          return;
        }
        const res = await sendMessageAction({
          orgSlug,
          conversationId,
          templateId,
          templateVariables: variables,
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Template sent.");
        setTemplateId("");
        setVariables({});
      } else {
        if (!body.trim()) {
          toast.error("Message can't be empty.");
          return;
        }
        const res = await sendMessageAction({
          orgSlug,
          conversationId,
          body: body.trim(),
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        setBody("");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-3"
    >
      {mustUseTemplate && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          The 24-hour customer-service window is closed — freeform is disabled by Meta policy.
          Send an approved template instead.
        </p>
      )}

      <div className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          disabled={mustUseTemplate}
          onClick={() => setMode("freeform")}
          className={cn(
            "rounded-full border px-3 py-1 transition-colors",
            effectiveMode === "freeform"
              ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]"
              : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg-muted))]",
            mustUseTemplate && "cursor-not-allowed opacity-50",
          )}
        >
          Freeform
        </button>
        <button
          type="button"
          onClick={() => setMode("template")}
          className={cn(
            "rounded-full border px-3 py-1 transition-colors",
            effectiveMode === "template"
              ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))]"
              : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg-muted))]",
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
            className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
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
              <p className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 font-mono text-xs text-[rgb(var(--fg))]">
                {selectedTemplate.bodyPreview}
              </p>
              {(selectedTemplate.variables ?? []).length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(selectedTemplate.variables ?? []).map((v) => (
                    <Input
                      key={v}
                      value={variables[v] ?? ""}
                      onChange={(e) =>
                        setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      placeholder={`{{${v}}}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-[rgb(var(--fg-subtle))]">
          Enter for newline · Cmd/Ctrl+Enter to send
        </p>
        <Button type="submit" disabled={pending} variant="gradient" size="sm">
          {pending ? "Sending…" : (<><Send className="h-3.5 w-3.5" /> Send</>)}
        </Button>
      </div>
    </form>
  );
}
