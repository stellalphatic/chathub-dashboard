"use client";

import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-[7.5rem] rounded-full bg-surface-2/60" />;
  }

  const current = theme === "system" ? systemTheme : theme;

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-0.5 text-[rgb(var(--fg-subtle))] shadow-sm"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        onClick={() => setTheme("light")}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
          current === "light" && theme !== "system"
            ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))] shadow-sm"
            : "hover:text-[rgb(var(--fg))]"
        }`}
        title="Light"
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">Light</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "system"}
        onClick={() => setTheme("system")}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
          theme === "system"
            ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))] shadow-sm"
            : "hover:text-[rgb(var(--fg))]"
        }`}
        title="System"
      >
        <Laptop className="h-4 w-4" />
        <span className="sr-only">System</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
          current === "dark" && theme !== "system"
            ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--fg))] shadow-sm"
            : "hover:text-[rgb(var(--fg))]"
        }`}
        title="Dark"
      >
        <Moon className="h-4 w-4" />
        <span className="sr-only">Dark</span>
      </button>
    </div>
  );
}
