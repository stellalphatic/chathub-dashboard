"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateCustomerAction } from "@/lib/crm-actions";

export type CustomerEditInitial = {
  id: string;
  displayName: string;
  phoneE164: string;
  meetingBooked: boolean;
  meetingTime: string;
  metadataJson: string;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function CustomerEditForm({
  orgSlug,
  initial,
}: {
  orgSlug: string;
  initial: CustomerEditInitial;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [phoneE164, setPhoneE164] = useState(initial.phoneE164);
  const [meetingBooked, setMeetingBooked] = useState(initial.meetingBooked);
  const [meetingTime, setMeetingTime] = useState(initial.meetingTime);
  const [metadataJson, setMetadataJson] = useState(initial.metadataJson);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateCustomerAction({
        orgSlug,
        customerId: initial.id,
        displayName,
        phoneE164,
        meetingBooked,
        meetingTime,
        metadataJson,
      });
      if ("error" in res) {
        setMessage({ type: "err", text: res.error });
        return;
      }
      setMessage({ type: "ok", text: "Saved." });
      router.refresh();
    });
  }

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="grid gap-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/20 focus:ring-2"
            placeholder="Customer name"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Phone (E.164)
          </label>
          <input
            value={phoneE164}
            onChange={(e) => setPhoneE164(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white outline-none ring-emerald-500/20 focus:ring-2"
            placeholder="+15551234567"
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="button"
            role="switch"
            aria-checked={meetingBooked}
            onClick={() => setMeetingBooked((v) => !v)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              meetingBooked ? "bg-emerald-600" : "bg-zinc-700"
            }`}
          >
            <motion.span
              layout
              className="absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow"
              animate={{ x: meetingBooked ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            />
          </button>
          <span className="text-sm text-zinc-300">Meeting booked</span>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Meeting notes / time
          </label>
          <input
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
            disabled={!meetingBooked}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/20 focus:ring-2 disabled:opacity-40"
            placeholder="e.g. Sat 3 PM showroom"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Metadata (JSON object)
          </label>
          <textarea
            value={metadataJson}
            onChange={(e) => setMetadataJson(e.target.value)}
            rows={8}
            spellCheck={false}
            className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs leading-relaxed text-zinc-200 outline-none ring-emerald-500/20 focus:ring-2"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-xs text-zinc-500">
        <span>
          Last contact:{" "}
          <span className="text-zinc-400">
            {initial.lastContactedAt
              ? new Date(initial.lastContactedAt).toLocaleString()
              : "—"}
          </span>
        </span>
        <span className="hidden sm:inline">·</span>
        <span>
          Created:{" "}
          <span className="text-zinc-400">
            {new Date(initial.createdAt).toLocaleString()}
          </span>
        </span>
      </div>

      {message ? (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={
            message.type === "ok"
              ? "flex items-center gap-2 text-sm text-emerald-400"
              : "text-sm text-rose-400"
          }
        >
          {message.type === "ok" ? <Check className="size-4" /> : null}
          {message.text}
        </motion.p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <motion.button
          type="button"
          disabled={pending}
          onClick={() => submit()}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Save changes
        </motion.button>
        <Link
          href={`/app/${orgSlug}/inbox?c=${initial.id}`}
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/25 hover:text-white"
        >
          Open in Inbox
        </Link>
        <Link
          href={`/app/${orgSlug}/crm`}
          className="rounded-xl border border-transparent px-5 py-2.5 text-sm text-zinc-500 transition hover:text-white"
        >
          Back to list
        </Link>
      </div>
    </motion.div>
  );
}
