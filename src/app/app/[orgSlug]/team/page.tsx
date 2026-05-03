import { eq } from "drizzle-orm";
import { Mail, User as UserIcon } from "lucide-react";
import { OrgTeamPanel } from "@/components/app/org-team-panel";
import { db } from "@/db";
import { organizationMember, user } from "@/db/schema";
import { assertOrgPage } from "@/lib/org-access";
import { ORG_MEMBER_ROLES, type OrgMemberRole } from "@/lib/org-permissions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ROLE_HELP: Record<OrgMemberRole, string> = {
  owner: "Full configuration + manage who is on the team.",
  admin: "Same as owner — use when you trust someone to add/remove members.",
  editor: "Bot, knowledge, channels, templates, broadcasts — not team admin.",
  viewer: "Read-only everywhere (good for demos and stakeholders).",
  agent: "Inbox + customers + overview — no access to bot or channel settings.",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const access = await assertOrgPage(orgSlug, "team", "view");
  const { org } = access;

  const members = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: organizationMember.role,
      createdAt: organizationMember.createdAt,
    })
    .from(organizationMember)
    .innerJoin(user, eq(organizationMember.userId, user.id))
    .where(eq(organizationMember.organizationId, org.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[rgb(var(--fg))]">
          Team
        </h2>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">
          Roles control what each person can see and edit in this business. Platform staff can
          always adjust access from the staff console.
        </p>
      </div>

      {access.canManageOrgMembers ? (
        <OrgTeamPanel
          orgSlug={orgSlug}
          canManage
          members={members.map((m) => ({
            userId: m.userId,
            name: m.name,
            email: m.email,
            role: m.role,
          }))}
        />
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
          <CardDescription>
            Roles:{" "}
            {ORG_MEMBER_ROLES.map((r) => (
              <span key={r} className="mr-1 inline-block">
                <Badge variant="outline" className="text-[10px]">
                  {r}
                </Badge>
              </span>
            ))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-[rgb(var(--fg-muted))]">
          <ul className="space-y-1">
            {ORG_MEMBER_ROLES.map((r) => (
              <li key={r}>
                <strong className="text-[rgb(var(--fg))]">{r}:</strong> {ROLE_HELP[r]}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
              No members yet.
            </p>
          ) : (
            <ul className="divide-y divide-[rgb(var(--border))] rounded-xl border border-[rgb(var(--border))]">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full gradient-brand text-white">
                      {(m.name || m.email || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-[rgb(var(--fg))]">
                        {m.name || (
                          <span className="text-[rgb(var(--fg-subtle))]">(unnamed)</span>
                        )}
                      </p>
                      <p className="inline-flex items-center gap-1 text-xs text-[rgb(var(--fg-muted))]">
                        <Mail className="h-3 w-3" /> {m.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {m.role}
                    </Badge>
                    <span className="text-[10px] text-[rgb(var(--fg-subtle))]">
                      added {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
            <UserIcon className="h-4 w-4" />
          </span>
          <div className="text-sm">
            <p className="font-medium">Need to add someone?</p>
            <p className="mt-0.5 text-xs text-[rgb(var(--fg-muted))]">
              A ChatHub platform admin can invite them from the staff console and pick a role
              (viewer, agent, editor, …). Owners and admins in your business can change roles
              here anytime.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
