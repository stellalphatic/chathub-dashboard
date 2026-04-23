"use client";

import { useState, useTransition } from "react";
import { createDocumentFromTextAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddDocumentForm({ orgSlug }: { orgSlug: string }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        setOk(false);
        start(async () => {
          const res = await createDocumentFromTextAction({
            orgSlug,
            title,
            text,
          });
          if ("error" in res) setErr(res.error);
          else {
            setOk(true);
            setTitle("");
            setText("");
          }
        });
      }}
    >
      <div>
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Shipping policy"
        />
      </div>
      <div>
        <Label>Text</Label>
        <textarea
          rows={8}
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the content you want the bot to know…"
        />
      </div>
      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      )}
      {ok && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Queued for embedding.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Queuing…" : "Add to knowledge base"}
      </Button>
    </form>
  );
}
