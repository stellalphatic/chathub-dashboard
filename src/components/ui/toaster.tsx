"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      position="bottom-right"
      theme={(resolvedTheme === "light" ? "light" : "dark") as "light" | "dark"}
      richColors
      closeButton
      toastOptions={{
        className:
          "!rounded-xl !border !border-[rgb(var(--border))] !bg-[rgb(var(--surface))] !text-[rgb(var(--fg))]",
      }}
    />
  );
}
