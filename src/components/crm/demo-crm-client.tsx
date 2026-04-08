"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Calendar, Check, MessageCircle, Search, User } from "lucide-react";
import { DEMO_ORG_SLUG, demoCustomers, demoMessagesByCustomer } from "@/lib/demo-data";

type Row = {
  id: string;
  displayName: string;
  phoneE164: string;
  lastContactedAt: string | null;
  meetingBooked: boolean;
  meetingTime: string | null;
  metadataJson: string;
  messageCount: number;
};

function seedRows(): Row[] {
  return demoCustomers.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    phoneE164: c.phoneE164,
    lastContactedAt: c.lastContactedAt ?? null,
    meetingBooked: c.meetingBooked ?? false,
    meetingTime: c.meetingTime ?? null,
    metadataJson: JSON.stringify(c.metadata ?? {}, null, 2),
    messageCount: demoMessagesByCustomer[c.id]?.length ?? 0,
  }));
}

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

export function DemoCrmClient() {
  const [rows, setRows] = useState<Row[]>(seedRows);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(t) ||
        r.phoneE164.toLowerCase().includes(t),
    );
  }, [rows, q]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function patchSelected(partial: Partial<Row>) {
    if (!selectedId) return;
    setRows((prev) =>
      prev.map((r) => (r.id === selectedId ? { ...r, ...partial } : r)),
    );
  }

  function saveDetail() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">CRM (demo)</h2>
        <p className="text-sm text-zinc-500">
          Fully interactive preview — changes stay in this browser session only.
        </p>
      </div>

      <motion.form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name or phone…"
            className="w-full rounded-xl border border-white/10 bg-zinc-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none ring-emerald-500/30 transition focus:border-emerald-500/40 focus:ring-2"
          />
        </div>
      </motion.form>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
        <motion.div
          className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40"
          layout
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Msgs</th>
                  <th className="px-4 py-3 font-medium">Meeting</th>
                  <th className="w-24 px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <motion.tr
                    layout
                    key={r.id}
                    className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.04] ${
                      selectedId === r.id ? "bg-emerald-500/10" : ""
                    }`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                          <User className="size-4" aria-hidden />
                        </span>
                        <span className="font-medium text-white">
                          {r.displayName}
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
                    <td className="px-4 py-3 text-right text-xs text-emerald-400/90">
                      Edit →
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.aside
              key={selected.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="space-y-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900/80 to-black/40 p-5 shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-white">Edit contact</h3>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-xs text-zinc-500 hover:text-white"
                >
                  Close
                </button>
              </div>
              <label className="block text-xs uppercase text-zinc-500">
                Name
                <input
                  value={selected.displayName}
                  onChange={(e) => patchSelected({ displayName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <label className="block text-xs uppercase text-zinc-500">
                Phone
                <input
                  value={selected.phoneE164}
                  onChange={(e) => patchSelected({ phoneE164: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={selected.meetingBooked}
                  onChange={(e) =>
                    patchSelected({ meetingBooked: e.target.checked })
                  }
                  className="size-4 rounded border-white/20 bg-black/40"
                />
                Meeting booked
              </label>
              <label className="block text-xs uppercase text-zinc-500">
                Meeting details
                <input
                  value={selected.meetingTime ?? ""}
                  onChange={(e) => patchSelected({ meetingTime: e.target.value })}
                  disabled={!selected.meetingBooked}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-40"
                />
              </label>
              <label className="block text-xs uppercase text-zinc-500">
                Metadata (JSON)
                <textarea
                  value={selected.metadataJson}
                  onChange={(e) =>
                    patchSelected({ metadataJson: e.target.value })
                  }
                  rows={6}
                  className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <p className="text-xs text-zinc-600">
                Last contact: {formatShort(selected.lastContactedAt)}
              </p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => saveDetail()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  <Check className="size-4" />
                  Save (demo)
                </motion.button>
                <Link
                  href={`/demo/app/${DEMO_ORG_SLUG}/inbox`}
                  className="rounded-xl border border-white/15 px-4 py-2 text-center text-sm text-zinc-300 hover:border-white/25"
                >
                  Open inbox
                </Link>
              </div>
              <AnimatePresence>
                {savedFlash ? (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-xs text-emerald-400"
                  >
                    Saved locally — sign in for persistent CRM.
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </motion.aside>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/20 p-6 text-center text-sm text-zinc-500"
            >
              Select a row to edit fields, toggle meetings, and adjust JSON
              metadata.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
