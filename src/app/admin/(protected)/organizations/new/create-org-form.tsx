"use client";

import { useState, useTransition } from "react";
import { createOrganizationAction } from "@/app/admin/actions";
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
import { motion, AnimatePresence } from "framer-motion";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateOrgForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createOrganizationAction({
        name,
        slug: slug || slugify(name),
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("ok" in res && res.ok) {
        setSecret(res.ingestSecret);
        setCreatedSlug(res.slug);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New business</CardTitle>
        <CardDescription>
          Creates <code className="text-emerald-400">organization</code> row +
          ingest secret. n8n must use <code className="text-emerald-400">organization_id</code>{" "}
          in Postgres (SOP) or HTTP ingest headers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          {secret ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-sm text-zinc-300">
                Organization{" "}
                <span className="font-semibold text-white">{name}</span> created
                with slug{" "}
                <span className="font-mono text-emerald-400">{createdSlug}</span>
                .
              </p>
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">
                  Ingest secret (copy now — not shown again)
                </p>
                <pre className="mt-2 overflow-x-auto text-xs text-amber-100 break-all">
                  {secret}
                </pre>
              </div>
              <p className="text-xs text-zinc-500">
                HTTP ingest headers:{" "}
                <code className="text-emerald-400">X-ChatHub-Org: {createdSlug}</code>{" "}
                + <code className="text-emerald-400">X-ChatHub-Secret</code>
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={onSubmit}
              className="max-w-md space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Business name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setName(v);
                    if (!slugManual) setSlug(slugify(v));
                  }}
                  placeholder="Modern Motors"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="modern-motors"
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                {pending ? "Creating…" : "Create organization"}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
