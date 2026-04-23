import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channelConnection } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectChannelForm } from "@/components/channels/connect-channel-form";
import { DeleteChannelButton } from "@/components/channels/delete-channel-button";

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const rows = await db
    .select()
    .from(channelConnection)
    .where(eq(channelConnection.organizationId, org.id));

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Channel connections</h2>
        <p className="text-sm text-zinc-400">
          Paste credentials here. Webhook secrets and API keys are encrypted
          with AES-GCM before storage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook URLs to register</CardTitle>
          <CardDescription>
            Point each provider to these URLs. Signature secrets go in server
            env (see DEPLOY.md).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs font-mono text-zinc-300">
          <p>WhatsApp (YCloud): <span className="text-emerald-400">{appOrigin}/api/webhooks/ycloud</span></p>
          <p>Instagram / Messenger (Meta): <span className="text-emerald-400">{appOrigin}/api/webhooks/meta</span></p>
          <p>ManyChat: <span className="text-emerald-400">{appOrigin}/api/webhooks/manychat</span></p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
            No channels connected yet.
          </p>
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>
                    {r.label || `${r.provider} → ${r.channel}`}
                  </span>
                  <DeleteChannelButton orgSlug={orgSlug} id={r.id} />
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  {r.provider} · {r.channel}{r.externalId ? ` · ${r.externalId}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400">
                status: <span className="text-emerald-300">{r.status}</span>
                {r.lastErrorMessage && (
                  <p className="mt-1 text-red-300">last error: {r.lastErrorMessage}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connect a new channel</CardTitle>
          <CardDescription>
            Provider + credentials. You can rotate later by deleting and
            re-adding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectChannelForm orgSlug={orgSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
