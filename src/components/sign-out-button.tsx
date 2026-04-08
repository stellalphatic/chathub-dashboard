"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-zinc-400 hover:text-white"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
    >
      Sign out
    </Button>
  );
}
