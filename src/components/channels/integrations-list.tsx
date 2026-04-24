"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronDown,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { connectChannelAction } from "@/lib/org-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  INTEGRATIONS,
  type Integration,
} from "./integrations-data";

type ConnectedSummary = {
  provider: string;
  channel: string;
  externalId: string | null;
};

export function IntegrationsList({
  orgSlug,
  appOrigin,
  connected,
}: {
  orgSlug: string;
  appOrigin: string;
  connected: ConnectedSummary[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const grouped = INTEGRATIONS.reduce<
    Record<Integration["category"], Integration[]>
  >((acc, it) => {
    acc[it.category] = acc[it.category] ?? [];
    acc[it.category].push(it);
    return acc;
  }, { whatsapp: [], instagram: [], messenger: [] });

  const isConnected = (it: Integration) =>
    connected.some(
      (c) => c.provider === it.provider && c.channel === it.channel,
    );

  return (
    <div className="space-y-8">
      {(["whatsapp", "instagram", "messenger"] as const).map((category) => {
        const items = grouped[category];
        if (!items || items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--fg-subtle))]">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="space-y-3">
              {items.map((it) => (
                <IntegrationCard
                  key={it.id}
                  integration={it}
                  orgSlug={orgSlug}
                  appOrigin={appOrigin}
                  connected={isConnected(it)}
                  open={openId === it.id}
                  onToggle={() =>
                    setOpenId((cur) => (cur === it.id ? null : it.id))
                  }
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IntegrationCard({
  integration: it,
  orgSlug,
  appOrigin,
  connected,
  open,
  onToggle,
}: {
  integration: Integration;
  orgSlug: string;
  appOrigin: string;
  connected: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const webhookUrl = appOrigin
    ? `${appOrigin}${it.webhookPath}`
    : it.webhookPath;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] transition-colors",
        connected
          ? "border-[rgb(var(--accent)/0.35)] shadow-sm"
          : "border-[rgb(var(--border))]",
      )}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-[rgb(var(--surface-2))]"
        aria-expanded={open}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))]",
            it.colorCls,
          )}
        >
          <it.icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-[rgb(var(--fg))]">
              {it.title}
            </p>
            {it.recommended ? (
              <Badge variant="gradient" className="text-[9px]">
                Recommended
              </Badge>
            ) : null}
            {it.status === "test" ? (
              <Badge variant="warning" className="text-[9px]">
                Test immediately
              </Badge>
            ) : null}
            {it.status === "requires_approval" ? (
              <Badge variant="secondary" className="text-[9px]">
                Requires Meta approval
              </Badge>
            ) : null}
            <Badge
              variant={connected ? "success" : "secondary"}
              className="text-[9px]"
            >
              {connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <p className="mt-0.5 hidden text-xs text-[rgb(var(--fg-muted))] sm:block">
            {it.tagline}
          </p>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[rgb(var(--fg-subtle))] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-[rgb(var(--border))]"
          >
            <IntegrationBody
              it={it}
              orgSlug={orgSlug}
              webhookUrl={webhookUrl}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function IntegrationBody({
  it,
  orgSlug,
  webhookUrl,
}: {
  it: Integration;
  orgSlug: string;
  webhookUrl: string;
}) {
  const [tab, setTab] = useState<"setup" | "credentials">("setup");
  return (
    <div className="p-4">
      {/* Inline tab switch (looks like the reference) */}
      <div className="mb-4 flex items-center gap-4 border-b border-[rgb(var(--border))]">
        <TabButton
          active={tab === "setup"}
          onClick={() => setTab("setup")}
          icon={<BookOpenCheck className="h-3.5 w-3.5" />}
          label="Setup guide"
        />
        <TabButton
          active={tab === "credentials"}
          onClick={() => setTab("credentials")}
          icon={<KeyRound className="h-3.5 w-3.5" />}
          label="Credentials"
        />
      </div>

      {/* Webhook URL strip (always visible under the tabs) */}
      <div className="mb-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
          Paste this URL in your{" "}
          <span className="text-[rgb(var(--fg))]">{it.title.split(" ")[0]}</span> flow / webhook
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-1.5 font-mono text-[11px] text-[rgb(var(--fg))]">
            {webhookUrl}
          </code>
          <CopyButton value={webhookUrl} />
        </div>
        {it.webhookHelp ? (
          <p className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">{it.webhookHelp}</p>
        ) : null}
      </div>

      {/*
        Render BOTH tabs and just hide the inactive one. If we mount/unmount
        the credentials form each time the tab changes, React resets its
        internal state and everything the user typed is lost.
      */}
      <div className={tab === "setup" ? "" : "hidden"}>
        <ol className="space-y-4">
          {it.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.15)] text-[11px] font-semibold text-[rgb(var(--accent))]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[rgb(var(--fg))]">
                  {s.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--fg-muted))]">
                  {s.body}
                </p>
                {s.links && s.links.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.links.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--accent))] hover:underline"
                      >
                        {l.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {it.docsUrl ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-[rgb(var(--border))] p-3">
            <p className="text-xs text-[rgb(var(--fg-muted))]">
              Need more detail?
            </p>
            <Button size="sm" variant="ghost" asChild>
              <a href={it.docsUrl} target="_blank" rel="noreferrer">
                Full docs <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end">
          <Button
            type="button"
            variant="gradient"
            size="sm"
            onClick={() => setTab("credentials")}
          >
            Enter credentials <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className={tab === "credentials" ? "" : "hidden"}>
        <CredentialsForm it={it} orgSlug={orgSlug} />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-1 pb-2 text-sm font-medium transition-colors",
        active
          ? "text-[rgb(var(--fg))]"
          : "text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]",
      )}
    >
      {icon}
      {label}
      {active ? (
        <motion.span
          layoutId="tab-underline"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--accent))]"
          transition={{ type: "spring", stiffness: 360, damping: 32 }}
        />
      ) : null}
    </button>
  );
}

function CredentialsForm({
  it,
  orgSlug,
}: {
  it: Integration;
  orgSlug: string;
}) {
  const [label, setLabel] = useState("");
  const [externalId, setExternalId] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await connectChannelAction({
            orgSlug,
            channel: it.channel,
            provider: it.provider,
            label: label || it.title,
            externalId: externalId || undefined,
            config,
            secrets,
          });
          if ("error" in res) {
            toast.error(res.error);
          } else {
            toast.success(`${it.title} connected.`);
            setLabel("");
            setExternalId("");
            setConfig({});
            setSecrets({});
          }
        });
      }}
    >
      <div>
        <Label>Internal label</Label>
        <Input
          className="mt-1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={it.title}
        />
        <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
          Shown on the Channels list. Defaults to the integration name.
        </p>
      </div>

      {it.externalIdField ? (
        <div>
          <Label>{it.externalIdField.label}</Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={externalId}
            placeholder={it.externalIdField.placeholder}
            onChange={(e) => setExternalId(e.target.value)}
          />
          {it.externalIdField.help ? (
            <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
              {it.externalIdField.help}
            </p>
          ) : null}
        </div>
      ) : null}

      {it.configFields.length > 0 ? (
        <div className="space-y-3">
          {it.configFields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input
                className="mt-1"
                value={config[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, [f.key]: e.target.value }))
                }
              />
              {f.help ? (
                <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
                  {f.help}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
          Encrypted at rest · AES-256-GCM
        </p>
        {it.secretFields.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input
              className="mt-1 font-mono text-xs"
              type={f.type ?? "password"}
              value={secrets[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) =>
                setSecrets((p) => ({ ...p, [f.key]: e.target.value }))
              }
            />
            {f.help ? (
              <p className="mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
                {f.help}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <Button
        type="submit"
        variant="gradient"
        disabled={pending}
        className="w-full sm:w-auto"
      >
        {pending ? "Connecting…" : "Save & connect"}
      </Button>
    </form>
  );
}
