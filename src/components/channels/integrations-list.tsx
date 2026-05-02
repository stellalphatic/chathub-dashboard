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
import { isStaleServerActionError } from "@/lib/errors";
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

export type ConnectedSummary = {
  /** channel_connection.id — used to build per-business webhook URLs. */
  id: string;
  provider: string;
  channel: string;
  externalId: string | null;
  /** channel_connection.webhookSecret — the per-business verify token. */
  webhookSecret: string | null;
  label: string | null;
};

export function IntegrationsList({
  orgSlug,
  appOrigin,
  connected,
  metaVerifyToken,
  metaAppSecretSet,
}: {
  orgSlug: string;
  appOrigin: string;
  connected: ConnectedSummary[];
  /** Platform-wide META_VERIFY_TOKEN — passed in by the server component
   *  so admins can copy/paste it into Meta's webhook config. */
  metaVerifyToken?: string | null;
  /** Whether META_APP_SECRET is set on the platform (we don't expose the
   *  value, just status). Drives the "set this in Amplify" callout. */
  metaAppSecretSet?: boolean;
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

  /**
   * Pick the most-recent connection matching this integration. We display
   * its per-business webhook URL + verify token in the Meta callout once
   * a connection exists.
   */
  const findConnection = (it: Integration): ConnectedSummary | undefined =>
    connected.find(
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
                  metaVerifyToken={metaVerifyToken}
                  metaAppSecretSet={metaAppSecretSet}
                  existingConnection={findConnection(it)}
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
  metaVerifyToken,
  metaAppSecretSet,
  existingConnection,
}: {
  integration: Integration;
  orgSlug: string;
  appOrigin: string;
  connected: boolean;
  open: boolean;
  onToggle: () => void;
  metaVerifyToken?: string | null;
  metaAppSecretSet?: boolean;
  existingConnection?: ConnectedSummary;
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
              metaVerifyToken={metaVerifyToken}
              metaAppSecretSet={metaAppSecretSet}
              existingConnection={existingConnection}
              appOrigin={appOrigin}
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
  metaVerifyToken,
  metaAppSecretSet,
  existingConnection,
  appOrigin,
}: {
  it: Integration;
  orgSlug: string;
  webhookUrl: string;
  metaVerifyToken?: string | null;
  metaAppSecretSet?: boolean;
  existingConnection?: ConnectedSummary;
  appOrigin: string;
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

      {/* Provider webhook URL — Meta uses per-connection URLs only (see callout). */}
      {it.provider !== "meta" ? (
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
      ) : null}

      {/* Meta-specific helper. AFTER you save credentials, this shows the
          PER-BUSINESS webhook URL + verify token to paste into THAT
          business's Meta App webhook config. Each onboarded business
          brings their own Meta app, so nothing here is platform-wide. */}
      {it.provider === "meta" && (
        <MetaVerifyCallout
          appOrigin={appOrigin}
          metaChannel={it.channel === "messenger" ? "messenger" : "instagram"}
          existingConnection={existingConnection}
          platformVerifyToken={metaVerifyToken ?? null}
          platformAppSecretSet={Boolean(metaAppSecretSet)}
        />
      )}

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

/**
 * Multi-tenant Meta callout.
 *
 * Each onboarded business has THEIR OWN Meta app. So we generate a unique
 * per-business webhook URL + verify token at connect time and show them
 * here for the user to paste into their app's Webhooks config.
 *
 * Two states:
 *   1. Not connected yet — show "Save credentials first, then this card
 *      will show your unique URL and verify token."
 *   2. Connected — show the per-business URL + the auto-generated
 *      `webhookSecret` (verify token) with copy buttons.
 *
 * The platform-wide META_VERIFY_TOKEN / META_APP_SECRET are now optional
 * fallbacks (only used when a connection has no app secret stored —
 * e.g. for legacy single-tenant testing or if you're hosting your own
 * Meta app for everyone). We show their status as a footnote.
 */
function MetaVerifyCallout({
  appOrigin,
  metaChannel,
  existingConnection,
  platformVerifyToken,
  platformAppSecretSet,
}: {
  appOrigin: string;
  metaChannel: "instagram" | "messenger";
  existingConnection?: ConnectedSummary;
  platformVerifyToken: string | null;
  platformAppSecretSet: boolean;
}) {
  const [showToken, setShowToken] = useState(false);

  const isConnected = Boolean(
    existingConnection?.id && existingConnection?.webhookSecret,
  );
  const perBizUrl = existingConnection
    ? `${appOrigin || ""}/api/webhooks/meta/${existingConnection.id}`
    : "";
  const perBizToken = existingConnection?.webhookSecret ?? "";

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border p-3",
        isConnected
          ? "border-[rgb(var(--accent)/0.35)] bg-[rgb(var(--accent)/0.06)]"
          : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
            isConnected ? "bg-[rgb(var(--accent))]" : "bg-[rgb(var(--fg-subtle))]",
          )}
        >
          {isConnected ? "✓" : "→"}
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--fg))]">
          {isConnected
            ? "Per-business Meta webhook (paste these into your Meta App)"
            : "After you save credentials, your unique webhook URL + verify token will appear here"}
        </p>
      </div>

      {isConnected ? (
        <>
          <p className="mb-2 text-[11px] text-[rgb(var(--fg-muted))]">
            Each tenant uses its own Meta app. These values are unique to{" "}
            <strong>this connection</strong> — paste them into{" "}
            {metaChannel === "instagram" ? (
              <>
                Meta → Instagram → <strong>API setup with Instagram Login</strong> →{" "}
                <strong>Configure webhooks</strong>
              </>
            ) : (
              <>
                Meta → Messenger → <strong>Webhooks</strong>
              </>
            )}{" "}
            (same callback URL for Development and Live).
          </p>

          <div className="space-y-2">
            <div>
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                Callback URL — same URL for testing and production
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-1.5 font-mono text-[11px] text-[rgb(var(--fg))]">
                  {perBizUrl}
                </code>
                <CopyButton value={perBizUrl} />
              </div>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                Verify token — paste in the same Configure webhooks panel
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-1.5 font-mono text-[11px] text-[rgb(var(--fg))]">
                  {showToken ? perBizToken : "•".repeat(Math.min(48, perBizToken.length))}
                </code>
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="rounded-md border border-[rgb(var(--border))] px-2 py-1 text-[10px] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface))]"
                >
                  {showToken ? "Hide" : "Show"}
                </button>
                <CopyButton value={perBizToken} />
              </div>
            </div>
          </div>

          <p className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">
            Inbound POSTs use <strong>X-Hub-Signature-256</strong>, verified with
            the <strong>App Secret</strong> from your Credentials tab (not the
            verify token). One webhook URL for Development and Live — Meta does
            not use a separate “production webhook” for the Instagram Graph path.
          </p>
        </>
      ) : (
        <>
          <p className="text-[11px] text-[rgb(var(--fg-muted))]">
            {metaChannel === "instagram" ? (
              <>
                Step 1 — enter <strong>Instagram App ID</strong>, <strong>Instagram App Secret</strong>, and{" "}
                <strong>access token</strong> (optional: Instagram Business Account ID if auto-detect fails).
              </>
            ) : (
              <>
                Step 1 — enter <strong>Meta App ID</strong>, <strong>Page ID</strong>, <strong>App Secret</strong>, and{" "}
                <strong>Page access token</strong>.
              </>
            )}{" "}
            Click <em>Save &amp; connect</em>. Step 2 — copy the per-tenant{" "}
            <strong>Callback URL</strong> (<code className="font-mono text-[10px]">/api/webhooks/meta/&lt;connectionId&gt;</code>) and{" "}
            <strong>Verify token</strong> into Meta. Each business is isolated by <strong>connection id</strong> in the path — scalable for SaaS.
          </p>
          {(platformVerifyToken || platformAppSecretSet) && (
            <p className="mt-2 text-[10.5px] text-[rgb(var(--fg-subtle))]">
              <strong>Note:</strong> platform-wide{" "}
              <code className="font-mono">META_VERIFY_TOKEN</code>
              {platformVerifyToken ? " is set" : " not set"} +{" "}
              <code className="font-mono">META_APP_SECRET</code>
              {platformAppSecretSet ? " is set" : " not set"}. These are
              only used as fallbacks for the legacy{" "}
              <code className="font-mono">/api/webhooks/meta</code> URL —
              new businesses use the per-connection URL above.
            </p>
          )}
        </>
      )}
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

  function isRequired(field: { required?: boolean }): boolean {
    return field.required !== false;
  }

  function findMissingField(): string | null {
    if (it.externalIdField && isRequired(it.externalIdField) && !externalId.trim()) {
      return it.externalIdField.label;
    }
    for (const f of it.configFields) {
      if (isRequired(f) && !(config[f.key] ?? "").trim()) return f.label;
    }
    for (const f of it.secretFields) {
      if (isRequired(f) && !(secrets[f.key] ?? "").trim()) return f.label;
    }
    return null;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const missing = findMissingField();
        if (missing) {
          toast.error(`${missing} is required.`);
          return;
        }

        // Trim everything before sending. Whitespace in API keys is the #1
        // cause of "invalid auth" on first connect.
        const cleanSecrets: Record<string, string> = {};
        for (const [k, v] of Object.entries(secrets)) cleanSecrets[k] = v.trim();
        const cleanConfig: Record<string, string> = {};
        for (const [k, v] of Object.entries(config)) cleanConfig[k] = v.trim();

        // For YCloud (and similar 1-number setups) we auto-route inbound
        // webhooks by setting externalId = the sender phone if the user
        // didn't provide a separate Phone Number ID.
        const inferredExternalId =
          externalId.trim() ||
          cleanConfig.fromPhoneE164 ||
          cleanConfig.pageId ||
          cleanConfig.igUserId ||
          undefined;

        start(async () => {
          try {
            const res = await connectChannelAction({
              orgSlug,
              channel: it.channel,
              provider: it.provider,
              label: label.trim() || it.title,
              externalId: inferredExternalId,
              config: cleanConfig,
              secrets: cleanSecrets,
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
          } catch (e) {
            // After a redeploy the client's HTML may reference a Server
            // Action ID that doesn't exist on the new server. Detect and
            // hard-reload so the next click hits the new bundle.
            if (isStaleServerActionError(e)) {
              toast.message("Refreshing — a new version was deployed.");
              setTimeout(() => window.location.reload(), 500);
              return;
            }
            console.error("[connect-channel] failed:", e);
            toast.error(
              e instanceof Error
                ? e.message
                : "Couldn't save the connection. Try again.",
            );
          }
        });
      }}
    >
      {!it.hideLabelField ? (
        <div>
          <Label>Internal label (optional)</Label>
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
      ) : null}

      {it.externalIdField ? (
        <div>
          <Label>
            {it.externalIdField.label}
            {!isRequired(it.externalIdField) ? (
              <span className="ml-1 text-[11px] font-normal text-[rgb(var(--fg-subtle))]">
                (optional)
              </span>
            ) : null}
          </Label>
          <Input
            className="mt-1 font-mono text-xs"
            value={externalId}
            placeholder={it.externalIdField.placeholder}
            onChange={(e) => setExternalId(e.target.value)}
            required={isRequired(it.externalIdField)}
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
              <Label>
                {f.label}
                {!isRequired(f) ? (
                  <span className="ml-1 text-[11px] font-normal text-[rgb(var(--fg-subtle))]">
                    (optional)
                  </span>
                ) : null}
              </Label>
              <Input
                className="mt-1"
                value={config[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, [f.key]: e.target.value }))
                }
                required={isRequired(f)}
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
            <Label>
              {f.label}
              {!isRequired(f) ? (
                <span className="ml-1 text-[11px] font-normal text-[rgb(var(--fg-subtle))]">
                  (optional)
                </span>
              ) : null}
            </Label>
            <Input
              className="mt-1 font-mono text-xs"
              type={f.type ?? "password"}
              value={secrets[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) =>
                setSecrets((p) => ({ ...p, [f.key]: e.target.value }))
              }
              autoComplete="off"
              required={isRequired(f)}
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
