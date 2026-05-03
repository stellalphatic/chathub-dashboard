"use client";

import { useState, useTransition } from "react";
import { inviteClientUserAction } from "@/app/admin/actions-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ORG_MEMBER_ROLES,
  ORG_ROLE_LABELS,
  type OrgMemberRole,
} from "@/lib/org-permissions";

/**
 * Invite a business user via Clerk. An invitation email is sent with a link
 * to `/sign-up`. When the user finishes sign-up, they are added to this org
 * automatically (via `publicMetadata.pendingOrgId` → JIT sync).
 */
export function ProvisionClientForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgMemberRole>("agent");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await inviteClientUserAction({ organizationId, email, role });
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        setMsg(res.message);
        if (res.mode === "invited") {
          setEmail("");
        }
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client-email">Client email</Label>
        <Input
          id="client-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
          placeholder="client@theirbusiness.com"
        />
        <p className="text-xs text-zinc-500">
          Clerk sends an invitation email. The user clicks the link, verifies their email with a
          one-time code, and is added to this business automatically.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Access role</Label>
        <select
          id="invite-role"
          className="flex h-9 w-full max-w-md rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--fg))]"
          value={role}
          onChange={(e) => setRole(e.target.value as OrgMemberRole)}
          disabled={pending}
        >
          {ORG_MEMBER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ORG_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          Use <strong>Viewer</strong> for read-only demos; <strong>Agent</strong> for inbox and
          customers without bot or channel setup.
        </p>
      </div>
      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-emerald-400" role="status">
          {msg}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Inviting…" : "Send invitation"}
      </Button>
    </form>
  );
}
