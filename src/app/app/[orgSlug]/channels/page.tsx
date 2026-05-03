import { eq } from "drizzle-orm";
import { CheckCircle2, Plug } from "lucide-react";
import { db } from "@/db";
import { channelConnection } from "@/db/schema";
import { assertOrgPage } from "@/lib/org-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteChannelButton } from "@/components/channels/delete-channel-button";
import { IntegrationsList } from "@/components/channels/integrations-list";
import { formatBusinessChannelLabel } from "@/lib/channels/display-label";

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await assertOrgPage(orgSlug, "channels", "view");
  const { org } = access;
  const readOnly = !access.permissions.channels.edit;

  const rows = await db
    .select()
    .from(channelConnection)
    .where(eq(channelConnection.organizationId, org.id));

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[rgb(var(--fg))]">
          Integrations
        </h2>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          Connect WhatsApp, Instagram DM, and Facebook Messenger. Expand any card for the
          full step-by-step setup guide and the exact webhook URL to paste in the provider.
          Everything is encrypted at rest with AES-256-GCM.
        </p>
        {readOnly ? (
          <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            View-only: you can review connections and copy webhook URLs, but your role can&apos;t
            add or remove channels.
          </p>
        ) : null}
      </div>

      {/* Connected channels quick summary */}
      {rows.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Connected ({rows.length})
            </CardTitle>
            <CardDescription>
              Live channels for this business. Remove any to rotate credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[rgb(var(--border))] rounded-xl border border-[rgb(var(--border))]">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Plug className="h-4 w-4 text-[rgb(var(--accent))]" />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {r.label || `${r.provider} · ${r.channel}`}
                      </p>
                      <p className="truncate text-[10px] text-[rgb(var(--fg-subtle))]">
                        <span className="font-mono">
                          {r.provider} · {r.channel}
                          {r.externalId ? ` · ${r.externalId}` : ""}
                        </span>
                      </p>
                      <p className="truncate text-[11px] font-medium text-[rgb(var(--fg-muted))]">
                        {formatBusinessChannelLabel({
                          provider: r.provider,
                          channel: r.channel,
                          config: (r.config ?? {}) as Record<string, unknown>,
                          externalId: r.externalId,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={r.status === "active" ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {r.status}
                    </Badge>
                    {r.lastErrorMessage ? (
                      <span
                        className="max-w-[16rem] truncate text-[11px] text-rose-500"
                        title={r.lastErrorMessage}
                      >
                        {r.lastErrorMessage}
                      </span>
                    ) : null}
                    <DeleteChannelButton
                      orgSlug={orgSlug}
                      id={r.id}
                      label={r.label ?? `${r.provider} · ${r.channel}`}
                      readOnly={readOnly}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Advanced per-provider integration catalogue */}
      <IntegrationsList
        orgSlug={orgSlug}
        appOrigin={appOrigin}
        readOnly={readOnly}
        connected={rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          channel: r.channel,
          externalId: r.externalId,
          webhookSecret: r.webhookSecret,
          label: r.label,
        }))}
        // Platform-wide values are now optional fallbacks — used only by
        // the legacy /api/webhooks/meta URL. New businesses get unique
        // per-connection webhook URLs at /api/webhooks/meta/<id>.
        metaVerifyToken={process.env.META_VERIFY_TOKEN ?? null}
        metaAppSecretSet={Boolean(process.env.META_APP_SECRET)}
      />
    </div>
  );
}
