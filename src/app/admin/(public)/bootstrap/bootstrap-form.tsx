"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { bootstrapFirstAdminAction } from "@/app/admin/actions-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BootstrapForm() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? undefined;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await bootstrapFirstAdminAction({
        token,
        name,
        email,
        password,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        window.location.href = "/admin/login";
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>First staff account</CardTitle>
        <CardDescription>
          Run once on an empty database. Production: set{" "}
          <code className="text-emerald-400">CHATHUB_SETUP_TOKEN</code> and open{" "}
          <code className="text-emerald-400">/admin/bootstrap?token=…</code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create staff account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
