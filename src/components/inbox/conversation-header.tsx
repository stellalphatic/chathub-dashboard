"use client";

import { useTransition } from "react";
import { setConversationModeAction } from "@/lib/org-actions";
import { cn } from "@/lib/utils";
import { windowLabel } from "@/lib/window-24h";

export function ConversationHeader({
  orgSlug,
  conversationId,
  mode,
  channel,
  lastInboundAt,
  displayName,
  phoneE164,
}: {
  orgSlug: string;
  conversationId: string;
  mode: string;
  channel: string;
  lastInboundAt: Date | null;
  displayName: string | null;
  phoneE164: string | null;
}) {
  const [pending, start] = useTransition();
  const isBot = mode === "bot";

  return (
    <header className="border-b border-white/10 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">
            {displayName ||
              (phoneE164?.startsWith("ext:") ? "Customer" : phoneE164) ||
              "Unknown"}
          </p>
          <p className="font-mono text-[11px] text-emerald-400/90">
            {channel}
            {phoneE164 && !phoneE164.startsWith("ext:") ? ` · ${phoneE164}` : ""}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {windowLabel(lastInboundAt)}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await setConversationModeAction({
                orgSlug,
                conversationId,
                mode: isBot ? "human" : "bot",
              });
            });
          }}
          className={cn(
            "min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isBot
              ? "border-blue-500/40 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25"
              : "border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25",
          )}
          title="Toggle bot / human mode"
        >
          {pending ? "…" : isBot ? "Bot replying — take over" : "Human — hand back to bot"}
        </button>
      </div>
    </header>
  );
}
