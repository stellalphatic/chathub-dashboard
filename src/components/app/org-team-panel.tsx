"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  removeOrgMemberAction,
  updateOrgMemberRoleAction,
} from "@/lib/org-team-actions";
import {
  normalizeOrgMemberRole,
  ORG_MEMBER_ROLES,
  ORG_ROLE_LABELS,
  type OrgMemberRole,
} from "@/lib/org-permissions";
import { Button } from "@/components/ui/button";

export type TeamMemberRow = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
};

export function OrgTeamPanel({
  orgSlug,
  members,
  canManage,
}: {
  orgSlug: string;
  members: TeamMemberRow[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(members);

  function setRole(userId: string, role: OrgMemberRole) {
    start(async () => {
      const res = await updateOrgMemberRoleAction({ orgSlug, targetUserId: userId, role });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setLocal((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m)),
      );
      toast.success("Role updated.");
    });
  }

  function remove(userId: string) {
    start(async () => {
      const res = await removeOrgMemberAction({ orgSlug, targetUserId: userId });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setLocal((prev) => prev.filter((m) => m.userId !== userId));
      toast.success("Member removed.");
    });
  }

  if (!canManage) return null;

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
      <p className="text-sm font-medium text-[rgb(var(--fg))]">Manage roles</p>
      <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">
        Platform staff, owners, and admins can change roles or remove members. You can&apos;t
        remove the last owner/admin — promote someone else first.
      </p>
      <ul className="mt-4 divide-y divide-[rgb(var(--border))]">
        {local.map((m) => (
          <li
            key={m.userId}
            className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-[rgb(var(--fg))]">{m.name || m.email || "User"}</p>
              <p className="truncate text-xs text-[rgb(var(--fg-muted))]">{m.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 max-w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-xs text-[rgb(var(--fg))] sm:max-w-[min(100%,20rem)]"
                value={normalizeOrgMemberRole(m.role)}
                onChange={(e) => setRole(m.userId, e.target.value as OrgMemberRole)}
                disabled={pending}
              >
                {ORG_MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ORG_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-rose-600 dark:text-rose-300"
                disabled={pending}
                onClick={() => remove(m.userId)}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
