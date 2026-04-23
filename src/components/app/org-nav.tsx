"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = (orgSlug: string) =>
  [
    { href: `/app/${orgSlug}`, label: "Dashboard", match: "exact" as const },
    { href: `/app/${orgSlug}/inbox`, label: "Inbox", match: "prefix" as const },
    { href: `/app/${orgSlug}/crm`, label: "CRM", match: "prefix" as const },
    {
      href: `/app/${orgSlug}/broadcasts`,
      label: "Broadcasts",
      match: "prefix" as const,
    },
    {
      href: `/app/${orgSlug}/templates`,
      label: "Templates",
      match: "prefix" as const,
    },
    {
      href: `/app/${orgSlug}/knowledge`,
      label: "Knowledge",
      match: "prefix" as const,
    },
    { href: `/app/${orgSlug}/bot`, label: "Bot", match: "prefix" as const },
    {
      href: `/app/${orgSlug}/channels`,
      label: "Channels",
      match: "prefix" as const,
    },
    { href: `/app/${orgSlug}/team`, label: "Team", match: "prefix" as const },
  ] as const;

export function OrgNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const items = links(orgSlug);

  return (
    <nav className="flex w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1 sm:w-auto">
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
              "min-h-9 flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm touch-manipulation",
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
