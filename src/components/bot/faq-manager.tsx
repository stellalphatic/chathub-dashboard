"use client";

import { useState, useTransition } from "react";
import { addFaqAction, deleteFaqAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FaqManager({
  orgSlug,
  faqs,
}: {
  orgSlug: string;
  faqs: { id: string; question: string; answer: string; enabled: boolean }[];
}) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {faqs.length === 0 ? (
          <li className="p-3 text-sm text-zinc-500">No FAQs yet.</li>
        ) : (
          faqs.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  Q: {f.question}
                </p>
                <p className="truncate text-xs text-zinc-400">A: {f.answer}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  start(async () => {
                    await deleteFaqAction({ orgSlug, id: f.id });
                  });
                }}
                className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          start(async () => {
            const res = await addFaqAction({
              orgSlug,
              question: q,
              answer: a,
            });
            if ("error" in res) setErr(res.error);
            else {
              setQ("");
              setA("");
            }
          });
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Question (e.g. What are your hours?)"
        />
        <textarea
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={a}
          onChange={(e) => setA(e.target.value)}
          placeholder="Answer the bot should send verbatim."
        />
        {err && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Add FAQ"}
        </Button>
      </form>
    </div>
  );
}
