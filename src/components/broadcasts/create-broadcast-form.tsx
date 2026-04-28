"use client";

import {
  Calendar,
  CheckCircle2,
  Megaphone,
  Send,
  Tag,
  Users,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createBroadcastAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ChannelKind = "whatsapp" | "instagram" | "messenger";

const STATUS_OPTIONS = [
  { id: "new", label: "New" },
  { id: "active", label: "Active" },
  { id: "follow_up", label: "Follow-up" },
  { id: "converted", label: "Converted" },
  { id: "dnd", label: "Do not disturb" },
];

export function CreateBroadcastForm({
  orgSlug,
  approvedTemplates,
}: {
  orgSlug: string;
  approvedTemplates: {
    id: string;
    name: string;
    language: string;
    variables: string[];
  }[];
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(approvedTemplates[0]?.id ?? "");
  const [channel, setChannel] = useState<ChannelKind>("whatsapp");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [tags, setTags] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [limit, setLimit] = useState("");
  const [mode, setMode] = useState<"draft" | "now" | "schedule">("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const template = useMemo(
    () => approvedTemplates.find((t) => t.id === templateId),
    [approvedTemplates, templateId],
  );

  const toggleStatus = (id: string) => {
    setStatuses((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  };

  const submit = () => {
    setErr(null);
    setOk(null);

    if (!name.trim()) {
      setErr("Give the broadcast a name (e.g. 'Eid promo')");
      return;
    }
    if (!templateId) {
      setErr("Pick an approved template");
      return;
    }
    if (mode === "schedule" && !scheduledFor) {
      setErr("Pick a date/time for the scheduled send");
      return;
    }

    start(async () => {
      const res = await createBroadcastAction({
        orgSlug,
        name: name.trim(),
        templateId,
        channel: channel as "whatsapp",
        defaultVariables: variables,
        audienceTags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        audienceStatuses: statuses,
        audienceLimit: limit ? Number(limit) : undefined,
        runNow: mode === "now",
        scheduledFor:
          mode === "schedule" && scheduledFor
            ? new Date(scheduledFor).toISOString()
            : undefined,
      });
      if ("error" in res) {
        setErr(res.error);
      } else {
        setOk(
          mode === "now"
            ? "Broadcast launched. Recipients are being queued now."
            : mode === "schedule"
              ? "Scheduled. The worker will dispatch at the configured time."
              : "Saved as draft. Run it later from the list below.",
        );
        setName("");
        setVariables({});
        setTags("");
        setStatuses([]);
        setLimit("");
      }
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* Name + template + channel */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Broadcast name</Label>
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Eid promo Q3"
          />
          <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
            Internal label. Customers don&apos;t see this.
          </p>
        </div>
        <div>
          <Label>Channel</Label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelKind)}
            className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram" disabled>
              Instagram (coming soon)
            </option>
            <option value="messenger" disabled>
              Messenger (coming soon)
            </option>
          </select>
        </div>
      </div>

      <div>
        <Label>Approved template</Label>
        <select
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setVariables({});
          }}
          className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
        >
          <option value="">Pick a template…</option>
          {approvedTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.language}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
          Outside of the 24-hour customer-service window WhatsApp requires an
          approved template. Create + submit one in the{" "}
          <a
            href={`/app/${orgSlug}/templates`}
            className="text-[rgb(var(--accent))] hover:underline"
          >
            Templates
          </a>{" "}
          tab and mirror its name + body from your YCloud dashboard.
        </p>
      </div>

      {/* Variable defaults */}
      {template && template.variables.length > 0 && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
          <Label className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
            Default variable values
          </Label>
          <p className="mt-0.5 text-[11px] text-[rgb(var(--fg-muted))]">
            Used when a customer record doesn&apos;t override the value.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {template.variables.map((v) => (
              <div key={v}>
                <Label className="font-mono text-[11px]">{`{{${v}}}`}</Label>
                <Input
                  className="mt-0.5 text-sm"
                  value={variables[v] ?? ""}
                  onChange={(e) =>
                    setVariables((p) => ({ ...p, [v]: e.target.value }))
                  }
                  placeholder={`Default for {{${v}}}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audience */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-[rgb(var(--accent))]" />
          <p className="text-sm font-medium">Audience</p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">By status</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                const active = statuses.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleStatus(s.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active
                        ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]"
                        : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg-muted))] hover:border-[rgb(var(--accent)/0.4)]",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="flex items-center gap-1 text-xs">
                <Tag className="h-3 w-3" /> By tag (comma-separated)
              </Label>
              <Input
                className="mt-1"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="vip, promo, returning"
              />
            </div>
            <div>
              <Label className="text-xs">Max recipients</Label>
              <Input
                className="mt-1"
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="e.g. 1000 (blank = no limit)"
                min={1}
              />
            </div>
          </div>

          {statuses.length === 0 && !tags.trim() && (
            <p className="text-[11px] text-[rgb(var(--fg-subtle))]">
              No audience filter selected → broadcast goes to{" "}
              <strong className="text-[rgb(var(--fg-muted))]">every</strong>{" "}
              customer in this business (capped by Max recipients if set).
            </p>
          )}
        </div>
      </div>

      {/* When */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[rgb(var(--accent))]" />
          <p className="text-sm font-medium">When to send</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ModeChip
            active={mode === "now"}
            onClick={() => setMode("now")}
            icon={<Send className="h-3.5 w-3.5" />}
            label="Send now"
            sub="Worker queues immediately"
          />
          <ModeChip
            active={mode === "schedule"}
            onClick={() => setMode("schedule")}
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Schedule"
            sub="Pick date + time"
          />
          <ModeChip
            active={mode === "draft"}
            onClick={() => setMode("draft")}
            icon={<Megaphone className="h-3.5 w-3.5" />}
            label="Save as draft"
            sub="Run it manually later"
          />
        </div>

        {mode === "schedule" && (
          <div className="mt-3">
            <Label className="text-xs">Scheduled for</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={new Date(Date.now() + 60_000)
                .toISOString()
                .slice(0, 16)}
            />
            <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
              Uses your browser&apos;s local timezone. The worker checks every minute and
              dispatches at the configured time.
            </p>
          </div>
        )}
      </div>

      {err && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {err}
        </p>
      )}
      {ok && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> {ok}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="submit" variant="gradient" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "now"
              ? "Launch broadcast"
              : mode === "schedule"
                ? "Schedule broadcast"
                : "Save draft"}
        </Button>
      </div>
    </form>
  );
}

function ModeChip({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]"
          : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-2))]",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--fg))]">
        {icon}
        {label}
      </span>
      <span className="text-[11px] text-[rgb(var(--fg-muted))]">{sub}</span>
    </button>
  );
}
