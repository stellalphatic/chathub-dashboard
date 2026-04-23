"use client";

import { useState, useTransition } from "react";
import { promotePlatformStaffByEmailAction } from "@/app/admin/actions-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PromoteStaffForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        setErr(null);
        start(async () => {
          const res = await promotePlatformStaffByEmailAction({ email });
          if ("error" in res) {
            setErr(res.error ?? "Request failed");
            return;
          }
          setMsg("Staff access granted. They can sign in at /admin/login.");
          setEmail("");
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="promote-email" className="text-zinc-200">
          Existing user email
        </Label>
        <Input
          id="promote-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@yourcompany.com"
          className="border-white/15 bg-zinc-900/80 text-white"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Grant staff access"}
      </Button>
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
    </form>
  );
}
