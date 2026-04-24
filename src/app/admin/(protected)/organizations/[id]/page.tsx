import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  ArrowLeft,
  ExternalLink,
  IdCard,
  Lock,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { getOrganizationAdmin } from "@/app/admin/actions";
import { AddMemberForm } from "./add-member-form";
import { OrgConfigLockForm } from "./org-config-lock-form";
import { ProvisionClientForm } from "./provision-client-form";
import { db } from "@/db";
import { organizationMember, user as userTable } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function OrganizationAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrganizationAdmin(id);
  if (!org) notFound();

  const settings =
    org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  const clientConfigLocked = Boolean(settings.clientConfigReadOnly);

  const members = await db
    .select({
      email: userTable.email,
      name: userTable.name,
      role: organizationMember.role,
    })
    .from(organizationMember)
    .innerJoin(userTable, eq(organizationMember.userId, userTable.id))
    .where(eq(organizationMember.organizationId, org.id));

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] transition-colors hover:text-[rgb(var(--fg))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Businesses
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{org.name}</h1>
            {clientConfigLocked ? (
              <Badge variant="warning">Config locked</Badge>
            ) : (
              <Badge variant="secondary">Client-editable</Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-[rgb(var(--fg-subtle))] sm:text-sm">
            {org.slug}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/app/${org.slug}`}>
            Open dashboard <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* IDs / secrets strip */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
              Organization ID
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-[rgb(var(--surface-2))] px-2 py-1 font-mono text-xs">
                {org.id}
              </code>
              <CopyButton value={org.id} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
              Ingest secret (HTTP)
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-[rgb(var(--surface-2))] px-2 py-1 font-mono text-xs">
                {org.ingestSecret ? "•".repeat(16) + org.ingestSecret.slice(-6) : "—"}
              </code>
              {org.ingestSecret ? <CopyButton value={org.ingestSecret} /> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="access">
            <UserPlus className="h-3.5 w-3.5" /> Access
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-3.5 w-3.5" /> Members
          </TabsTrigger>
          <TabsTrigger value="config">
            <Lock className="h-3.5 w-3.5" /> Config lock
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <ShieldCheck className="h-3.5 w-3.5" /> Integrations
          </TabsTrigger>
        </TabsList>

        {/* ACCESS — invite / link */}
        <TabsContent value="access">
          <div className="space-y-4">
            <Card>
              <CardContent className="flex items-start gap-3 p-4 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium">Multiple users per business</p>
                  <p className="mt-0.5 text-xs text-[rgb(var(--fg-muted))]">
                    You can add as many people as you want — partners, employees, agents — each
                    with their own email. Each login gets full CRM + Inbox access to{" "}
                    <strong>{org.name}</strong>. Invite once below; repeat for every address.
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Invite new client login</CardTitle>
                  <CardDescription>
                    Sends a Clerk invitation email. The user verifies with a one-time code at{" "}
                    <Link
                      href="/sign-up"
                      className="text-[rgb(var(--accent))] hover:underline"
                    >
                      /sign-up
                    </Link>{" "}
                    and is auto-attached to this business.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProvisionClientForm organizationId={org.id} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Link existing account</CardTitle>
                  <CardDescription>
                    If the person already has a ChatHub login, just attach them by email.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddMemberForm organizationId={org.id} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* MEMBERS list */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members ({members.length})</CardTitle>
              <CardDescription>Everyone with access to this business.</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4 text-sm text-[rgb(var(--fg-muted))]">
                  No members yet — invite someone from the Access tab.
                </p>
              ) : (
                <ul className="divide-y divide-[rgb(var(--border))] rounded-xl border border-[rgb(var(--border))]">
                  {members.map((m) => (
                    <li
                      key={m.email}
                      className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-muted))]">
                          <IdCard className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-[rgb(var(--fg))]">{m.name}</p>
                          <p className="truncate text-[rgb(var(--fg-muted))]">{m.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 self-start sm:self-center">
                        {m.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIG LOCK */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Client configuration lock</CardTitle>
              <CardDescription>
                When locked, the business sees a read-only bot config. Only platform staff can
                change persona, FAQs, system prompt, and channel integrations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrgConfigLockForm
                organizationId={org.id}
                initiallyLocked={clientConfigLocked}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTEGRATIONS (status / shortcuts) */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Channel and model integrations live on the client dashboard. Use these shortcuts
                to jump straight in (staff can edit even when the config is locked).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {[
                { href: `/app/${org.slug}/channels`, label: "Channels (YCloud / Meta / ManyChat)" },
                { href: `/app/${org.slug}/bot`, label: "Bot config (persona, style, prompt)" },
                { href: `/app/${org.slug}/knowledge`, label: "Knowledge base (RAG docs)" },
                { href: `/app/${org.slug}/templates`, label: "Message templates" },
                { href: `/app/${org.slug}/broadcasts`, label: "Broadcasts & scheduling" },
              ].map((l) => (
                <Button key={l.href} asChild variant="secondary" className="justify-between">
                  <Link href={l.href}>
                    {l.label} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
