"use client";

import { useState, useTransition } from "react";
import { setOrganizationClientConfigLockAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function OrgConfigLockForm({
  organizationId,
  initiallyLocked,
}: {
  organizationId: string;
  initiallyLocked: boolean;
}) {
  const [locked, setLocked] = useState(initiallyLocked);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (next: boolean) => {
    setError(null);
    start(async () => {
      const res = await setOrganizationClientConfigLockAction({
        organizationId,
        locked: next,
      });
      if ("error" in res) {
        setError(res.error ?? "Request failed");
        return;
      }
      setLocked(next);
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        When enabled, the business dashboard can still view inbox and CRM, but{" "}
        <strong className="text-zinc-200">bot persona, FAQs, and channel integrations</strong> can only
        be changed by platform staff (or from this staff console).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant={locked ? "secondary" : "default"}
          disabled={pending}
          onClick={() => toggle(true)}
        >
          Lock client config
        </Button>
        <Button
          type="button"
          variant={locked ? "default" : "secondary"}
          disabled={pending}
          onClick={() => toggle(false)}
        >
          Allow client edits
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Current:{" "}
        <span className={locked ? "text-amber-300" : "text-emerald-400"}>
          {locked ? "Locked (staff-managed)" : "Unlocked (client can edit)"}
        </span>
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
