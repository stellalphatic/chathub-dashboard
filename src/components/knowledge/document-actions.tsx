"use client";

import { Trash2 } from "lucide-react";
import { deleteDocumentAction } from "@/lib/org-actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DocumentActions({
  orgSlug,
  id,
  title,
}: {
  orgSlug: string;
  id: string;
  title?: string;
}) {
  return (
    <ConfirmButton
      title="Delete this document?"
      description={
        <>
          {title ? (
            <>
              <strong>{title}</strong> and all its indexed vectors will be removed. The bot will
              stop retrieving from it immediately.
            </>
          ) : (
            "This document and all its indexed vectors will be removed."
          )}{" "}
          This can't be undone.
        </>
      }
      confirmLabel="Delete document"
      successToast="Document removed"
      action={async () => {
        const res = await deleteDocumentAction({ orgSlug, id });
        return res;
      }}
    >
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </ConfirmButton>
  );
}
