"use client";

import { Trash2 } from "lucide-react";
import { deleteChannelAction } from "@/lib/org-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteChannelButton({
  orgSlug,
  id,
  label,
}: {
  orgSlug: string;
  id: string;
  label?: string;
}) {
  return (
    <ConfirmButton
      title="Remove this channel connection?"
      description={
        <>
          The credentials for {label ? <strong>{label}</strong> : "this channel"} will be
          deleted. Inbound webhooks from this channel will stop routing. You can re-add later.
        </>
      }
      confirmLabel="Remove channel"
      successToast="Channel removed"
      action={async () => {
        const res = await deleteChannelAction({ orgSlug, id });
        return res;
      }}
    >
      <Trash2 className="h-3.5 w-3.5" /> Remove
    </ConfirmButton>
  );
}
