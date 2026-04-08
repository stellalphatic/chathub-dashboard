"use client";

import { usePathname, useRouter } from "next/navigation";

type Org = { slug: string; name: string };

export function AppOrgNav({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const match = pathname?.match(/^\/app\/([^/]+)/);
  const currentSlug = match?.[1] ?? orgs[0]?.slug ?? "";

  if (orgs.length === 0) return null;

  return (
    <div className="w-full min-w-0 sm:hidden">
      <label htmlFor="org-switch" className="sr-only">
        Switch business
      </label>
      <select
        id="org-switch"
        className="w-full min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white touch-manipulation"
        value={currentSlug}
        onChange={(e) => {
          const slug = e.target.value;
          if (slug) router.push(`/app/${slug}`);
        }}
      >
        {orgs.map((o) => (
          <option key={o.slug} value={o.slug} className="bg-zinc-900">
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
