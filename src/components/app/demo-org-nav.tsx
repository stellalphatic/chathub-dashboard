"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const base = (slug: string) => `/demo/app/${slug}`;

export function DemoOrgNav() {
  const pathname = usePathname();
  const slug = DEMO_ORG_SLUG;
  const items = [
    { href: base(slug), label: "Dashboard", match: "exact" as const },
    { href: `${base(slug)}/inbox`, label: "Inbox", match: "prefix" as const },
    { href: `${base(slug)}/crm`, label: "CRM", match: "prefix" as const },
  ];

  return (
    <nav className="flex w-full gap-2 rounded-xl border border-white/10 bg-white/5 p-1 sm:w-auto">
      {items.map(({ href, label, match }) => {
        const active =
          match === "exact"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "min-h-10 flex-1 touch-manipulation rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4",
              active
                ? "bg-emerald-500/20 text-white shadow-sm ring-1 ring-emerald-500/30"
                : "text-zinc-300 hover:bg-white/5 hover:text-white",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
