"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <ClerkSignOutButton redirectUrl="/">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-zinc-400 hover:text-white"
      >
        Sign out
      </Button>
    </ClerkSignOutButton>
  );
}
