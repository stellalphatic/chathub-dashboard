"use client";

import { useState, useTransition } from "react";
import { addOrganizationMemberAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ORG_MEMBER_ROLES,
  ORG_ROLE_LABELS,
  type OrgMemberRole,
} from "@/lib/org-permissions";

/** Link a user who already has login credentials (created elsewhere or for another org). */
export function AddMemberForm({ organizationId }: { organizationId: string }) {
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
      const res = await addOrganizationMemberAction({ organizationId, email, role });
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        setMsg("Linked. They can open this business after signing in.");
        setEmail("");
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="link-email">Existing account email</Label>
        <Input
          id="link-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="already-created@client.com"
          required
        />
      </div>
      <div className="w-full space-y-2 sm:w-56">
        <Label htmlFor="link-role">Role</Label>
        <select
          id="link-role"
          className="flex h-9 w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--fg))]"
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
      </div>
      <Button type="submit" disabled={pending} variant="secondary" className="w-full sm:w-auto">
        {pending ? "Linking…" : "Link to business"}
      </Button>
      {err ? (
        <p className="w-full text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="w-full text-sm text-emerald-400" role="status">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
