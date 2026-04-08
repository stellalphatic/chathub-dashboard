import Link from "next/link";
import { redirect } from "next/navigation";
import { DEMO_ORG_SLUG, demoOrg } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

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
          <nav className="flex w-full gap-2 rounded-xl border border-white/10 bg-white/5 p-1 sm:w-auto">
            <Link
              href={`/demo/app/${DEMO_ORG_SLUG}`}
              className={cn(
                "min-h-10 flex-1 touch-manipulation rounded-lg px-3 py-2.5 text-center text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white sm:flex-none sm:px-4",
              )}
            >
              Dashboard
            </Link>
            <Link
              href={`/demo/app/${DEMO_ORG_SLUG}/inbox`}
              className={cn(
                "min-h-10 flex-1 touch-manipulation rounded-lg px-3 py-2.5 text-center text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white sm:flex-none sm:px-4",
              )}
            >
              Inbox
            </Link>
          </nav>
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
