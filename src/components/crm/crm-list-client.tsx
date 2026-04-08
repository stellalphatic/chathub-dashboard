"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Calendar, MessageCircle, Search, User } from "lucide-react";

export type CrmRow = {
  id: string;
  displayName: string | null;
  phoneE164: string;
  lastContactedAt: string | null;
  meetingBooked: boolean;
  meetingTime: string | null;
  createdAt: string;
  messageCount: number;
};

function formatShort(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function CrmListClient({
  orgSlug,
  initialQuery,
  rows,
}: {
  orgSlug: string;
  initialQuery: string;
  rows: CrmRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  const applySearch = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const t = value.trim();
      if (t) next.set("q", t);
      else next.delete("q");
      startTransition(() => {
        router.push(`/app/${orgSlug}/crm?${next.toString()}`);
      });
    },
    [orgSlug, router, searchParams],
  );

  return (
    <div className="space-y-4">
      <motion.form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          applySearch(q);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone…"
            className="w-full rounded-xl border border-white/10 bg-zinc-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none ring-emerald-500/30 transition focus:border-emerald-500/40 focus:ring-2"
            autoComplete="off"
          />
        </div>
        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? "Searching…" : "Search"}
        </motion.button>
      </motion.form>

      <motion.div
        className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Messages</th>
                <th className="px-4 py-3 font-medium">Last contact</th>
                <th className="px-4 py-3 font-medium">Meeting</th>
                <th className="px-4 py-3 font-medium w-28" />
              </tr>
            </thead>
            <motion.tbody
              variants={{
                show: { transition: { staggerChildren: 0.035 } },
              }}
              initial="hidden"
              animate="show"
            >
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-zinc-500"
                  >
                    No contacts match this search. Ingest conversations via{" "}
                    <code className="text-emerald-400">/api/v1/ingest</code>.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <motion.tr
                    key={r.id}
                    variants={{
                      hidden: { opacity: 0, x: -6 },
                      show: { opacity: 1, x: 0 },
                    }}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                          <User className="size-4" aria-hidden />
                        </span>
                        <span className="font-medium text-white">
                          {r.displayName || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {r.phoneE164}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-zinc-300">
                        <MessageCircle className="size-3 text-emerald-500/80" />
                        {r.messageCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatShort(r.lastContactedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {r.meetingBooked ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                          <Calendar className="size-3.5" />
                          {r.meetingTime || "Booked"}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/${orgSlug}/crm/${r.id}`}
                        className="inline-flex rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                      >
                        Open
                      </Link>
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>
      </motion.div>

      <p className="text-center text-xs text-zinc-600">
        {rows.length} contact{rows.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
