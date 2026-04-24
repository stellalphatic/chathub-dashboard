"use client";

import { useTransition } from "react";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { setTemplateStatusAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";

type Status = "approved" | "rejected" | "pending" | "draft";

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
  const act = (next: Status) => {
    start(async () => {
      const res = await setTemplateStatusAction({ orgSlug, id, status: next });
      if (res && "error" in res && res.error) toast.error(res.error);
      else toast.success(`Marked ${next}.`);
    });
  };
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {status !== "approved" && (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => act("approved")}
          className="!border-emerald-500/30 !bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-300 hover:!bg-emerald-500/20"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </Button>
      )}
      {status !== "pending" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => act("pending")}
        >
          <Clock3 className="h-3.5 w-3.5" /> Pending
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => act("rejected")}
          className="!border-rose-500/30 !bg-rose-500/10 !text-rose-600 dark:!text-rose-300 hover:!bg-rose-500/20"
        >
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      )}
    </div>
  );
}
