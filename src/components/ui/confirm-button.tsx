"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "./dialog";

type ActionResult = void | { error?: string | null; ok?: boolean } | { ok: true };

type ConfirmButtonProps = Omit<ButtonProps, "onClick"> & {
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Called when the user confirms. Return `{ error }` to show a toast. */
  action: () => Promise<ActionResult>;
  /** Text/node inside the trigger button. Defaults to an icon + "Delete". */
  children?: React.ReactNode;
  successToast?: string;
};

export function ConfirmButton({
  title = "Are you sure?",
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  action,
  children,
  successToast,
  variant = "destructive",
  size = "sm",
  ...buttonProps
}: ConfirmButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} {...buttonProps}>
          {children ?? (
            <>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const res = (await action()) as { error?: string | null } | void;
                if (res && typeof res === "object" && "error" in res && res.error) {
                  toast.error(String(res.error));
                } else if (successToast) {
                  toast.success(successToast);
                }
                setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Action failed");
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
