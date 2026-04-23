"use client";

import { useMemo, useState, useTransition } from "react";
import { upsertTemplateAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateTemplateForm({ orgSlug }: { orgSlug: string }) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const variables = useMemo(() => {
    const set = new Set<string>();
    (body.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []).forEach((m) => {
      const n = m.match(/\d+/)?.[0];
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [body]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        setOk(false);
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
          if ("error" in res) setErr(res.error);
          else setOk(true);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>Template name (lowercase_underscore)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Language</Label>
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>
        <div>
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as typeof category)
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          >
            <option value="UTILITY">UTILITY</option>
            <option value="MARKETING">MARKETING</option>
            <option value="AUTHENTICATION">AUTHENTICATION</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Body</Label>
        <textarea
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hi {{1}}, your order {{2}} is ready for pickup."
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        />
        <p className="mt-1 text-xs text-zinc-500">
          detected variables: {variables.length ? variables.join(", ") : "none"}
        </p>
      </div>
      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      )}
      {ok && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Saved as draft. Submit to YCloud/Meta for approval, then mark
          approved.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save template"}
      </Button>
    </form>
  );
}
