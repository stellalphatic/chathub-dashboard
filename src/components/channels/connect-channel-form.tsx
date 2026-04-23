"use client";

import { useState, useTransition } from "react";
import { connectChannelAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Combo = {
  key: string;
  channel: "whatsapp" | "instagram" | "messenger";
  provider: "ycloud" | "meta" | "manychat";
  label: string;
  help: string;
  configFields: { key: string; label: string; placeholder?: string }[];
  secretFields: { key: string; label: string; placeholder?: string }[];
  externalIdField?: { label: string; placeholder?: string };
};

const COMBOS: Combo[] = [
  {
    key: "whatsapp-ycloud",
    channel: "whatsapp",
    provider: "ycloud",
    label: "WhatsApp · YCloud",
    help: "Use YCloud for WhatsApp inbound + outbound. Free-tier friendly.",
    configFields: [
      { key: "fromPhoneE164", label: "Sender phone (E.164)", placeholder: "+14151234567" },
    ],
    secretFields: [
      { key: "apiKey", label: "YCloud API key", placeholder: "yc_xxx" },
      { key: "wabaId", label: "WABA ID (optional)", placeholder: "" },
    ],
    externalIdField: {
      label: "Phone number ID (from YCloud)",
      placeholder: "required to route inbound webhooks",
    },
  },
  {
    key: "instagram-meta",
    channel: "instagram",
    provider: "meta",
    label: "Instagram · Meta Graph",
    help: "Direct Meta Graph API for Instagram DMs.",
    configFields: [
      { key: "igUserId", label: "IG user ID", placeholder: "17841..." },
    ],
    secretFields: [
      { key: "accessToken", label: "Page access token", placeholder: "EAAG..." },
      { key: "appSecret", label: "Meta app secret", placeholder: "" },
    ],
    externalIdField: {
      label: "IG user ID (same as config)",
      placeholder: "17841...",
    },
  },
  {
    key: "messenger-meta",
    channel: "messenger",
    provider: "meta",
    label: "Messenger · Meta Graph",
    help: "Direct Meta Graph API for Facebook page Messenger.",
    configFields: [
      { key: "pageId", label: "Facebook Page ID", placeholder: "1234567890" },
    ],
    secretFields: [
      { key: "accessToken", label: "Page access token" },
      { key: "appSecret", label: "Meta app secret" },
    ],
    externalIdField: { label: "Page ID", placeholder: "same as config" },
  },
  {
    key: "instagram-manychat",
    channel: "instagram",
    provider: "manychat",
    label: "Instagram · ManyChat",
    help: "Use if the business already runs IG flows in ManyChat.",
    configFields: [{ key: "channel", label: "channel (instagram)" }],
    secretFields: [{ key: "apiKey", label: "ManyChat API key" }],
    externalIdField: { label: "ManyChat page id", placeholder: "" },
  },
  {
    key: "messenger-manychat",
    channel: "messenger",
    provider: "manychat",
    label: "Messenger · ManyChat",
    help: "Use if the business already runs Messenger flows in ManyChat.",
    configFields: [{ key: "channel", label: "channel (messenger)" }],
    secretFields: [{ key: "apiKey", label: "ManyChat API key" }],
    externalIdField: { label: "ManyChat page id", placeholder: "" },
  },
];

export function ConnectChannelForm({ orgSlug }: { orgSlug: string }) {
  const [combo, setCombo] = useState(COMBOS[0]);
  const [label, setLabel] = useState("");
  const [externalId, setExternalId] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await connectChannelAction({
            orgSlug,
            channel: combo.channel,
            provider: combo.provider,
            label: label || combo.label,
            externalId: externalId || undefined,
            config,
            secrets,
          });
          if ("error" in res) setError(res.error);
          else {
            setLabel("");
            setExternalId("");
            setConfig({});
            setSecrets({});
          }
        });
      }}
    >
      <div>
        <Label>Provider / Channel</Label>
        <select
          value={combo.key}
          onChange={(e) => {
            const c = COMBOS.find((x) => x.key === e.target.value)!;
            setCombo(c);
            setConfig({});
            setSecrets({});
          }}
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          {COMBOS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">{combo.help}</p>
      </div>

      <div>
        <Label>Display label (optional)</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>

      {combo.externalIdField && (
        <div>
          <Label>{combo.externalIdField.label}</Label>
          <Input
            value={externalId}
            placeholder={combo.externalIdField.placeholder}
            onChange={(e) => setExternalId(e.target.value)}
          />
        </div>
      )}

      {combo.configFields.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Config
          </p>
          {combo.configFields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input
                value={config[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Secrets (encrypted)
        </p>
        {combo.secretFields.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input
              type="password"
              value={secrets[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) =>
                setSecrets((p) => ({ ...p, [f.key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect channel"}
      </Button>
    </form>
  );
}
