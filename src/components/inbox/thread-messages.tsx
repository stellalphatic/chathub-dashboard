"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, FileText, User, Video } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  direction: string;
  body: string;
  timeLabel: string;
  sentByBot?: boolean | null;
  status?: string | null;
  contentType?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
};

function AttachmentPreview({
  contentType,
  mediaUrl,
  mediaMimeType,
  outbound,
}: {
  contentType?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  outbound: boolean;
}) {
  if (!mediaUrl) return null;
  const mime = mediaMimeType?.toLowerCase() ?? "";
  const isImage = contentType === "image" || mime.startsWith("image/");
  const isAudio =
    contentType === "voice_note" ||
    contentType === "audio" ||
    mime.startsWith("audio/");
  const isVideo = contentType === "video" || mime.startsWith("video/");

  if (isImage) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="mb-1 block overflow-hidden rounded-xl border border-[rgb(var(--border))]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt="attachment"
          className="max-h-72 w-full object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  if (isAudio) {
    return (
      <audio
        controls
        preload="none"
        className={cn(
          "mb-1 w-full max-w-sm rounded-xl",
          outbound ? "opacity-95" : "",
        )}
        src={mediaUrl}
      >
        Your browser doesn&apos;t support audio playback.
      </audio>
    );
  }

  if (isVideo) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="mb-1 inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-xs text-[rgb(var(--fg))] hover:border-[rgb(var(--accent)/0.4)]"
      >
        <Video className="h-3.5 w-3.5 text-[rgb(var(--accent))]" />
        Video attachment
      </a>
    );
  }

  // document / unknown
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "mb-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
        outbound
          ? "bg-white/15 text-white hover:bg-white/25"
          : "border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))] hover:border-[rgb(var(--accent)/0.4)]",
      )}
    >
      <FileText className="h-3.5 w-3.5" />
      <span className="truncate">Download attachment</span>
    </a>
  );
}

export function ThreadMessages({
  threadKey,
  messages,
  emptyLabel,
}: {
  threadKey: string;
  messages: ThreadMessage[];
  emptyLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadKey, messages.length]);

  return (
    <div
      ref={scroller}
      className="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 py-4"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgb(var(--accent)/0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.06), transparent 35%)",
      }}
    >
      <AnimatePresence mode="wait">
        {messages.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 text-center text-sm text-[rgb(var(--fg-subtle))]"
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
              show: { transition: { staggerChildren: 0.03 } },
            }}
          >
            {messages.map((m) => {
              const outbound = m.direction === "outbound";
              const bot = outbound && m.sentByBot;
              return (
                <motion.li
                  key={m.id}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 8, scale: 0.98 },
                    show: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: "spring", stiffness: 360, damping: 28 },
                    },
                  }}
                  className={cn(
                    "flex gap-2",
                    outbound ? "justify-end" : "justify-start",
                  )}
                >
                  {!outbound ? (
                    <span className="mt-auto flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-muted))]">
                      <User className="h-3 w-3" />
                    </span>
                  ) : null}
                  <motion.div
                    layout
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                      outbound
                        ? bot
                          ? "rounded-br-md bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]"
                          : "rounded-br-md bg-blue-500 text-white"
                        : "rounded-bl-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg))]",
                    )}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <AttachmentPreview
                      contentType={m.contentType}
                      mediaUrl={m.mediaUrl}
                      mediaMimeType={m.mediaMimeType}
                      outbound={outbound}
                    />
                    {m.body ? (
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    ) : null}
                    <p
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        outbound ? "text-white/75" : "text-[rgb(var(--fg-subtle))]",
                      )}
                    >
                      {bot ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Bot className="h-2.5 w-2.5" /> AI
                        </span>
                      ) : null}
                      <span>{m.timeLabel}</span>
                      {outbound && m.status ? (
                        <span className="ml-0.5 opacity-80">· {m.status}</span>
                      ) : null}
                    </p>
                  </motion.div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
