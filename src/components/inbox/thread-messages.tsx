"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  direction: string;
  body: string;
  timeLabel: string;
};

export function ThreadMessages({
  threadKey,
  messages,
  emptyLabel,
}: {
  threadKey: string;
  messages: ThreadMessage[];
  emptyLabel: string;
}) {
  return (
    <div
      className="flex-1 space-y-2 overflow-y-auto px-3 py-4"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.06), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.05), transparent 35%)",
      }}
    >
      <AnimatePresence mode="wait">
        {messages.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 text-center text-sm text-zinc-500"
          >
            {emptyLabel}
          </motion.p>
        ) : (
          <motion.ul
            key={threadKey}
            className="space-y-2"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: 0.04 },
              },
            }}
          >
            {messages.map((m) => (
              <motion.li
                key={m.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 10, scale: 0.98 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: "spring", stiffness: 380, damping: 28 },
                  },
                }}
                className={cn(
                  "flex",
                  m.direction === "outbound" ? "justify-end" : "justify-start",
                )}
              >
                <motion.div
                  layout
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-md",
                    m.direction === "outbound"
                      ? "rounded-br-md bg-emerald-700/90 text-white"
                      : "rounded-bl-md border border-white/5 bg-zinc-800 text-zinc-100",
                  )}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 text-right text-[10px] opacity-60">
                    {m.timeLabel}
                  </p>
                </motion.div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
