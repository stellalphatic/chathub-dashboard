"use client";

import { useTransition } from "react";
import { deleteChannelAction } from "@/lib/org-actions";

export function DeleteChannelButton({
  orgSlug,
  id,
}: {
  orgSlug: string;
  id: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this channel connection?")) return;
        start(async () => {
          await deleteChannelAction({ orgSlug, id });
        });
      }}
      className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
