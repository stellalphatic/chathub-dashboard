"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soft refresh so new messages appear without a full reload. */
export function InboxAutoRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0.96 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/12 to-emerald-500/0"
        style={{ animation: "pulse-glow 4s ease-in-out infinite" }}
        aria-hidden
      />
      <div className="mb-3 flex items-center justify-end gap-2 text-xs text-zinc-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live sync · refreshes every 5s
      </div>
      {children}
    </motion.div>
  );
}
