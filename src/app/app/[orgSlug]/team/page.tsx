import { eq } from "drizzle-orm";
import { Mail, User as UserIcon } from "lucide-react";
import { db } from "@/db";
import { organizationMember, user } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const members = await db
    .select({
      id: user.id,
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
          Everyone who can open this business dashboard. New members are provisioned by a
          ChatHub admin — ask them to invite by email.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
          <CardDescription>
            Roles: <Badge variant="outline" className="text-[10px]">member</Badge> — full
            access to this business.
          </CardDescription>
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
                  key={m.id}
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
              Your ChatHub administrator can invite more members from the staff console in
              under a minute. They&apos;ll get a one-time sign-in code by email.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
