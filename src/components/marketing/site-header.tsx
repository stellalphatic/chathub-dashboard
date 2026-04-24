"use client";

import { Menu, X, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[rgb(var(--border))] bg-[rgb(var(--bg)/0.7)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl gradient-brand text-white shadow-md">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <span className="text-[rgb(var(--fg))]">ChatHub</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-[rgb(var(--fg-muted))] md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-[rgb(var(--fg))]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in?redirect_url=%2Fapp">Sign in</Link>
          </Button>
          <Button asChild size="sm" variant="gradient">
            <Link href="/contact">Get started</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-lg border border-[rgb(var(--border))] p-2 text-[rgb(var(--fg))] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 sm:px-6">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-3">
              <ThemeToggle />
              <div className="flex gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link href="/sign-in?redirect_url=%2Fapp">Sign in</Link>
                </Button>
                <Button asChild size="sm" variant="gradient">
                  <Link href="/contact">Get started</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
