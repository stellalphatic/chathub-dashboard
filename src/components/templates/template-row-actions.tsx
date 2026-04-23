"use client";

import { useTransition } from "react";
import { setTemplateStatusAction } from "@/lib/org-actions";

export function TemplateRowActions({
  orgSlug,
  id,
  status,
}: {
  orgSlug: string;
  id: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const act = (next: "approved" | "rejected" | "pending" | "draft") => {
    start(async () => {
      await setTemplateStatusAction({ orgSlug, id, status: next });
    });
  };
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {status !== "approved" && (
        <button
          disabled={pending}
          onClick={() => act("approved")}
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200 hover:bg-emerald-500/20"
        >
          Mark approved
        </button>
      )}
      {status !== "pending" && (
        <button
          disabled={pending}
          onClick={() => act("pending")}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-zinc-300 hover:bg-white/10"
        >
          Mark pending
        </button>
      )}
      {status !== "rejected" && (
        <button
          disabled={pending}
          onClick={() => act("rejected")}
          className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-200 hover:bg-red-500/20"
        >
          Mark rejected
        </button>
      )}
    </div>
  );
}
