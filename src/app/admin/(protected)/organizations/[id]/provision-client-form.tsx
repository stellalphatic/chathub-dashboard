"use client";

import { useState, useTransition } from "react";
import { provisionClientUserAction } from "@/app/admin/actions-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProvisionClientForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generatePassword = () => {
    const chars =
      "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let s = "";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 16; i++) s += chars[arr[i]! % chars.length];
    setPassword(s);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await provisionClientUserAction({
        organizationId,
        name,
        email,
        password,
      });
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        setMsg(res.message);
        if (res.mode === "created") {
          setPassword("");
          setName("");
          setEmail("");
        }
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="client-name">Client name</Label>
          <Input
            id="client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="client-email">Client email (sign-in)</Label>
          <Input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="client-password">Temporary password</Label>
              <Input
                id="client-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={generatePassword}
              className="w-full shrink-0 sm:w-auto"
            >
              Generate
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Share once over a secure channel; ask them to change it after first
            login (flow can be added later).
          </p>
        </div>
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
        {pending ? "Creating…" : "Create client login"}
      </Button>
    </form>
  );
}
