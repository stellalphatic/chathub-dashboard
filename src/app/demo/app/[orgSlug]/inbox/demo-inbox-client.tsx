"use client";

import { useState } from "react";
import { ThreadMessages } from "@/components/inbox/thread-messages";
import { cn } from "@/lib/utils";
import {
  demoCustomers,
  demoMessagesByCustomer,
  type DemoCustomer,
} from "@/lib/demo-data";

export function DemoInboxClient() {
  const [selected, setSelected] = useState<DemoCustomer>(demoCustomers[0]!);

  const thread = demoMessagesByCustomer[selected.id] ?? [];

  const messages = thread.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    timeLabel: m.timeLabel,
  }));

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
        <ThreadMessages
          threadKey={selected.id}
          messages={messages}
          emptyLabel="No messages in this preview thread."
        />
      </section>
    </div>
  );
}
