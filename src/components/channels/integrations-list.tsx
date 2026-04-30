"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronDown,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
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

type ConnectedSummary = {
  provider: string;
  channel: string;
  externalId: string | null;
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
}: {
  integration: Integration;
  orgSlug: string;
  appOrigin: string;
  connected: boolean;
  open: boolean;
  onToggle: () => void;
  metaVerifyToken?: string | null;
  metaAppSecretSet?: boolean;
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
}: {
  it: Integration;
  orgSlug: string;
  webhookUrl: string;
  metaVerifyToken?: string | null;
  metaAppSecretSet?: boolean;
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

      {/* Meta-specific helper: surface the platform's verify token + app
          secret status so admins can paste them straight into Meta's app
          Webhooks panel without hunting through env vars. */}
      {it.provider === "meta" && (
        <MetaVerifyCallout
          verifyToken={metaVerifyToken ?? null}
          appSecretSet={Boolean(metaAppSecretSet)}
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
 * Renders the platform's `META_VERIFY_TOKEN` (with a copy button + show /
 * hide toggle) and the status of `META_APP_SECRET`. This is exactly the
 * pair Meta's webhook config asks for: callback URL + verify token, plus
 * the app secret used for signature verification on inbound POSTs.
 *
 * If META_VERIFY_TOKEN isn't set yet, we generate a one-time random
 * suggestion the operator can copy → paste into Amplify env → paste into
 * Meta. We also show the same value in Meta's panel.
 */
function MetaVerifyCallout({
  verifyToken,
  appSecretSet,
}: {
  verifyToken: string | null;
  appSecretSet: boolean;
}) {
  const [showToken, setShowToken] = useState(false);
  const suggested = useSuggestedToken();
  const present = Boolean(verifyToken && verifyToken.trim());

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border p-3",
        present
          ? "border-[rgb(var(--accent)/0.35)] bg-[rgb(var(--accent)/0.06)]"
          : "border-amber-500/30 bg-amber-500/10",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
            present ? "bg-[rgb(var(--accent))] text-white" : "bg-amber-500 text-white",
          )}
        >
          {present ? "✓" : "!"}
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--fg))]">
          Meta App → Webhooks → Verify token
        </p>
      </div>

      {present ? (
        <>
          <p className="mb-2 text-[11px] text-[rgb(var(--fg-muted))]">
            Paste this value into the <strong>Verify token</strong> field on
            Meta&apos;s Webhooks panel (alongside the Callback URL above).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-1.5 font-mono text-[11px] text-[rgb(var(--fg))]">
              {showToken ? verifyToken : "•".repeat(Math.min(32, verifyToken!.length))}
            </code>
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="rounded-md border border-[rgb(var(--border))] px-2 py-1 text-[10px] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface))]"
            >
              {showToken ? "Hide" : "Show"}
            </button>
            <CopyButton value={verifyToken!} />
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-[rgb(var(--fg-muted))]">
            <strong>META_VERIFY_TOKEN</strong> isn&apos;t set on this deployment yet. Pick any random
            string, set it in Amplify env, and paste the same value into Meta&apos;s
            <strong> Verify token </strong>field. Suggested random value:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-amber-500/30 bg-[rgb(var(--surface))] px-2.5 py-1.5 font-mono text-[11px] text-[rgb(var(--fg))]">
              {suggested}
            </code>
            <CopyButton value={suggested} />
          </div>
          <p className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">
            Then in Amplify console → Hosting → Environment variables, add{" "}
            <code className="rounded bg-[rgb(var(--surface))] px-1 font-mono">
              META_VERIFY_TOKEN
            </code>{" "}
            with this value, redeploy, refresh this page.
          </p>
        </>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-[rgb(var(--border))] pt-3 text-[11px]">
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
            appSecretSet
              ? "bg-emerald-500 text-white"
              : "bg-amber-500 text-white",
          )}
        >
          {appSecretSet ? "✓" : "!"}
        </span>
        <span className="text-[rgb(var(--fg-muted))]">
          <strong>META_APP_SECRET</strong> {appSecretSet ? "is set " : "is NOT set "} —
          {appSecretSet
            ? " Inbound POSTs from Meta will be signature-verified."
            : " Inbound POSTs aren't currently signature-verified. Add it to Amplify env (Meta → App settings → Basic → App secret) for production."}
        </span>
      </div>
    </div>
  );
}

/**
 * One-time random suggestion shown when META_VERIFY_TOKEN isn't set yet.
 * Generated client-side; not stored. Stable per mount (`useMemo`).
 */
function useSuggestedToken(): string {
  return useMemo(() => {
    if (typeof window === "undefined") return "";
    const arr = new Uint8Array(24);
    window.crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }, []);
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
