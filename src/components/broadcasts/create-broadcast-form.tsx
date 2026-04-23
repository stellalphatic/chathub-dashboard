"use client";

import { useMemo, useState, useTransition } from "react";
import { createBroadcastAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateBroadcastForm({
  orgSlug,
  approvedTemplates,
}: {
  orgSlug: string;
  approvedTemplates: { id: string; name: string; language: string; variables: string[] }[];
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [tags, setTags] = useState("");
  const [statuses, setStatuses] = useState("");
  const [limit, setLimit] = useState("");
  const [runNow, setRunNow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const template = useMemo(
    () => approvedTemplates.find((t) => t.id === templateId),
    [approvedTemplates, templateId],
  );

  if (approvedTemplates.length === 0) {
    return (
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        You need at least one <b>approved</b> template to send a broadcast.
        Create one in the Templates tab and mark it approved after Meta/YCloud
        signs off.
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        setOk(false);
        start(async () => {
          const res = await createBroadcastAction({
            orgSlug,
            name,
            templateId,
            channel: "whatsapp",
            defaultVariables: variables,
            audienceTags: tags.split(",").map((s) => s.trim()).filter(Boolean),
            audienceStatuses: statuses.split(",").map((s) => s.trim()).filter(Boolean),
            audienceLimit: limit ? Number(limit) : undefined,
            runNow,
          });
          if ("error" in res) setErr(res.error);
          else {
            setOk(true);
            setName("");
            setVariables({});
            setTags("");
            setStatuses("");
            setLimit("");
          }
        });
      }}
    >
      <div>
        <Label>Broadcast name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Template (approved only)</Label>
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setVariables({});
          }}
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          <option value="">Pick a template…</option>
          {approvedTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.language})
            </option>
          ))}
        </select>
      </div>
      {template && template.variables.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {template.variables.map((v) => (
            <input
              key={v}
              value={variables[v] ?? ""}
              onChange={(e) =>
                setVariables((p) => ({ ...p, [v]: e.target.value }))
              }
              placeholder={`{{${v}}}`}
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>Audience tags</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip,promo" />
        </div>
        <div>
          <Label>Audience statuses</Label>
          <Input
            value={statuses}
            onChange={(e) => setStatuses(e.target.value)}
            placeholder="active,follow_up"
          />
        </div>
        <div>
          <Label>Limit</Label>
          <Input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="1000"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={runNow}
          onChange={(e) => setRunNow(e.target.checked)}
        />
        Run now (otherwise saved as draft)
      </label>

      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      )}
      {ok && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Created.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create broadcast"}
      </Button>
    </form>
  );
}
