"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isStaleServerActionError } from "@/lib/errors";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/error]", error);
    if (isStaleServerActionError(error)) {
      const flag = "chathub:server-action-reload";
      try {
        const last = Number(sessionStorage.getItem(flag) ?? "0");
        if (Date.now() - last > 5_000) {
          sessionStorage.setItem(flag, String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Admin page failed to render
            </h2>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              {error.message && error.message.length < 200
                ? error.message
                : "Something failed while loading data. The rest of the admin console keeps working."}
            </p>
            {error.digest ? (
              <p className="font-mono text-[11px] text-[rgb(var(--fg-subtle))]">
                Ref: {error.digest}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => reset()} variant="gradient">
              <RefreshCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="ghost">
              <Link href="/admin">Admin home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
