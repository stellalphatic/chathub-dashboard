"use client";

import { UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppTopbar() {
  const { resolvedTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg)/0.8)] px-4 backdrop-blur-xl sm:px-6">
      <div className="min-w-0 flex-1" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserButton
          appearance={
            resolvedTheme === "dark" ? { baseTheme: dark } : undefined
          }
          userProfileProps={{
            appearance:
              resolvedTheme === "dark" ? { baseTheme: dark } : undefined,
          }}
        />
      </div>
    </header>
  );
}
