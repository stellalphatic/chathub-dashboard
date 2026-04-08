"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  demoCustomers,
  demoMessagesByCustomer,
  type DemoCustomer,
} from "@/lib/demo-data";

export function DemoInboxClient() {
  const [selected, setSelected] = useState<DemoCustomer>(demoCustomers[0]!);

  const thread = demoMessagesByCustomer[selected.id] ?? [];

  return (
    <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(0,14rem)_1fr] xl:grid-cols-[minmax(0,18rem)_1fr]">
      <aside className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Chats
          </p>
        </div>
        <ul className="max-h-[50vh] flex-1 divide-y divide-white/5 overflow-y-auto lg:max-h-none">
          {demoCustomers.map((cust) => {
            const active = cust.id === selected.id;
            return (
              <li key={cust.id}>
                <button
                  type="button"
                  onClick={() => setSelected(cust)}
                  className={cn(
                    "block w-full px-4 py-3 text-left transition-colors hover:bg-white/5 touch-manipulation",
                    active && "border-l-2 border-emerald-500 bg-emerald-500/10",
                  )}
                >
                  <p className="truncate font-medium text-white">
                    {cust.displayName}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-500">
                    {cust.phoneE164}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b141a] shadow-inner">
        <header className="border-b border-white/10 bg-zinc-900/40 px-4 py-3">
          <p className="font-semibold text-white">{selected.displayName}</p>
          <p className="font-mono text-xs text-emerald-400/90">
            {selected.phoneE164}
          </p>
        </header>
        <div
          className="flex-1 space-y-2 overflow-y-auto px-3 py-4"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.06), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.05), transparent 35%)",
          }}
        >
          {thread.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.direction === "outbound" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-md",
                  m.direction === "outbound"
                    ? "rounded-br-md bg-emerald-700/90 text-white"
                    : "rounded-bl-md border border-white/5 bg-zinc-800 text-zinc-100",
                )}
              >
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-right text-[10px] opacity-60">
                  {m.timeLabel}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
