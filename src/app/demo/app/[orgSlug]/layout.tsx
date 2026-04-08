import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoOrgNav } from "@/components/app/demo-org-nav";
import { DEMO_ORG_SLUG, demoOrg } from "@/lib/demo-data";

export default async function DemoAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  if (orgSlug !== DEMO_ORG_SLUG) {
    redirect(`/demo/app/${DEMO_ORG_SLUG}`);
  }

  return (
    <div>
      <header className="border-b border-white/10 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              ChatHub
            </span>
            <span className="truncate text-sm text-zinc-500">Demo</span>
          </div>
          <DemoOrgNav />
          <Link
            href="/login"
            className="text-center text-sm text-emerald-400 hover:underline sm:text-right"
          >
            Business sign in →
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{demoOrg.name}</h1>
          <p className="font-mono text-sm text-emerald-400/90">{demoOrg.slug}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
