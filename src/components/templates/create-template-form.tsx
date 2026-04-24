"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { upsertTemplateAction } from "@/lib/org-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateTemplateForm({ orgSlug }: { orgSlug: string }) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [body, setBody] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const variables = useMemo(() => {
    const set = new Set<string>();
    (body.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []).forEach((m) => {
      const n = m.match(/\d+/)?.[0];
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [body]);

  const rendered = useMemo(() => {
    return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, k: string) =>
      (vars[k] ?? `{{${k}}}`).toString(),
    );
  }, [body, vars]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await upsertTemplateAction({
            orgSlug,
            channel: "whatsapp",
            name,
            language,
            category,
            bodyPreview: body,
            variables,
          });
          if ("error" in res) {
            toast.error(res.error);
          } else {
            toast.success("Template saved as draft. Submit to Meta/YCloud for approval, then mark approved.");
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Template name</Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="appointment_reminder"
          />
        </div>
        <div>
          <Label>Language</Label>
          <Input
            className="mt-1"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="en, ur, es…"
          />
        </div>
        <div>
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
          >
            <option value="UTILITY">UTILITY</option>
            <option value="MARKETING">MARKETING</option>
            <option value="AUTHENTICATION">AUTHENTICATION</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Body</Label>
        <Textarea
          className="mt-1 font-mono text-xs"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {{1}}, your order {{2}} is ready for pickup."
        />
        <p className="mt-1 text-xs text-[rgb(var(--fg-subtle))]">
          Use <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>, … for substitutions.{" "}
          {variables.length ? (
            <>
              Detected:{" "}
              {variables.map((v) => (
                <Badge key={v} variant="secondary" className="ml-1 text-[10px]">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </>
          ) : (
            <span>No variables yet.</span>
          )}
        </p>
      </div>

      {variables.length > 0 && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
            <Eye className="h-3.5 w-3.5" /> Variable values (preview only)
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {variables.map((v) => (
              <div key={v}>
                <Label className="text-xs">{`{{${v}}}`}</Label>
                <Input
                  className="mt-1"
                  value={vars[v] ?? ""}
                  onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                  placeholder={`value for {{${v}}}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
          Preview
        </p>
        <div className="flex max-w-md">
          <div className="rounded-2xl rounded-bl-sm bg-emerald-500/15 px-4 py-2.5 text-sm text-[rgb(var(--fg))] shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
              <FileText className="h-3 w-3" /> {name || "template"} · {language}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {rendered || "Your template preview will appear here."}
            </p>
          </div>
        </div>
      </div>

      <Button type="submit" variant="gradient" disabled={pending}>
        {pending ? "Saving…" : "Save template"}
      </Button>
    </form>
  );
}
