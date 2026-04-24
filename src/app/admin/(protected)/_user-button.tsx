"use client";

import { UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

export function AdminUserButton() {
  const { resolvedTheme } = useTheme();
  return (
    <UserButton
      appearance={resolvedTheme === "dark" ? { baseTheme: dark } : undefined}
      userProfileProps={{
        appearance:
          resolvedTheme === "dark" ? { baseTheme: dark } : undefined,
      }}
    />
  );
}
