"use client";

import { useState, useTransition } from "react";
import { addOrganizationMemberAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Link a user who already has login credentials (created elsewhere or for another org). */
export function AddMemberForm({ organizationId }: { organizationId: string }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await addOrganizationMemberAction({ organizationId, email });
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
