"use client";

import { useTransition } from "react";
import {
  ArrowLeft,
  Archive,
  Bot,
  CheckCheck,
  Hand,
  MoreVertical,
  Moon,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  clearConversationHistoryAction,
  deleteConversationAction,
  setConversationModeAction,
  setConversationStatusAction,
} from "@/lib/org-actions";
import { cn } from "@/lib/utils";
import { windowLabel } from "@/lib/window-24h";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ConversationHeader({
  orgSlug,
  conversationId,
  mode,
  status,
  channel,
  lastInboundAt,
  displayName,
  phoneE164,
  avatarUrl,
  businessChannelLabel,
  canEditInbox = true,
}: {
  orgSlug: string;
  conversationId: string;
  mode: string;
  status: string;
  channel: string;
  lastInboundAt: Date | null;
  displayName: string | null;
  phoneE164: string | null;
  /** Customer profile image (e.g. Instagram `profile_pic` from Graph). */
  avatarUrl?: string | null;
  /** Our connected WhatsApp / Instagram / Messenger identity for this thread. */
  businessChannelLabel?: string | null;
  /** When false, hide AI toggle and thread management actions (view-only inbox). */
  canEditInbox?: boolean;
}) {
  const [pending, start] = useTransition();
  const isBot = mode === "bot";

  const toggleMode = () => {
    start(async () => {
      const res = await setConversationModeAction({
        orgSlug,
        conversationId,
        mode: isBot ? "human" : "bot",
      });
      if (res && "error" in res && res.error) toast.error(res.error);
      else toast.success(isBot ? "Switched to Human (AI paused)" : "AI re-enabled");
    });
  };

  const setStatusTo = (next: "open" | "snoozed" | "closed") => {
    start(async () => {
      const res = await setConversationStatusAction({
        orgSlug,
        conversationId,
        status: next,
      });
      if (res && "error" in res && res.error) toast.error(res.error);
      else toast.success(`Marked ${next}.`);
    });
  };

  const subtitle = [
    channel,
    phoneE164 && !phoneE164.startsWith("ext:") ? phoneE164 : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const params = useParams<{ orgSlug?: string }>();
  const orgSlugFromUrl = params?.orgSlug ?? "";

  return (
    <header className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {/* Mobile back button — drops to the chat list, hidden on lg+ */}
        <Link
          href={`/app/${orgSlugFromUrl || orgSlug}/inbox`}
          className="-ml-1 mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))] lg:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName ? `${displayName} profile` : "Customer profile"}
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full border border-[rgb(var(--border))] object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <p className="truncate font-semibold text-[rgb(var(--fg))]">
            {displayName ||
              (phoneE164?.startsWith("ext:") ? "Customer" : phoneE164) ||
              "Unknown"}
          </p>
          {status !== "open" ? (
            <Badge variant="secondary" className="text-[10px]">
              {status}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-[rgb(var(--fg-subtle))]">
          {subtitle}
        </p>
        {businessChannelLabel ? (
          <p className="mt-1 truncate text-[11px] font-medium text-[rgb(var(--accent))]">
            {businessChannelLabel}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-[rgb(var(--fg-muted))]">
          {windowLabel(lastInboundAt)}
        </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canEditInbox ? (
          <>
        <button
          type="button"
          disabled={pending}
          onClick={toggleMode}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isBot
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
          )}
          title={isBot ? "Pause AI, take over" : "Re-enable AI"}
        >
          {isBot ? <Bot className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />}
          {pending ? "…" : isBot ? "AI ON — take over" : "Human — resume AI"}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="More">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setStatusTo("open")}>
              <CheckCheck className="h-4 w-4" /> Mark open
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusTo("snoozed")}>
              <Moon className="h-4 w-4" /> Snooze
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusTo("closed")}>
              <Archive className="h-4 w-4" /> Close
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Danger zone</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <ConfirmButton
                variant="ghost"
                size="sm"
                className="!w-full !justify-start !px-2 !font-normal !text-[rgb(var(--fg))]"
                title="Reset chat history?"
                description="All messages in this conversation will be deleted so the bot starts fresh. The customer stays in your CRM."
                confirmLabel="Reset history"
                successToast="Chat history cleared."
                action={async () =>
                  clearConversationHistoryAction({ orgSlug, conversationId })
                }
              >
                <RefreshCw className="h-4 w-4" /> Reset history
              </ConfirmButton>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <ConfirmButton
                variant="ghost"
                size="sm"
                className="!w-full !justify-start !px-2 !font-normal !text-rose-600 dark:!text-rose-300"
                title="Delete entire conversation?"
                description="This removes the thread and every message. The customer record stays in the CRM. This cannot be undone."
                confirmLabel="Delete conversation"
                successToast="Conversation deleted."
                action={async () =>
                  deleteConversationAction({ orgSlug, conversationId })
                }
              >
                <Trash2 className="h-4 w-4" /> Delete conversation
              </ConfirmButton>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
          </>
        ) : (
          <span className="rounded-full border border-[rgb(var(--border))] px-3 py-1 text-[11px] text-[rgb(var(--fg-muted))]">
            Inbox (view only)
          </span>
        )}
      </div>
    </header>
  );
}
