import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-500/90">
        404
      </p>
      <h1 className="max-w-md text-3xl font-semibold text-white sm:text-4xl">
        This page isn&apos;t in your ChatHub workspace
      </h1>
      <p className="max-w-md text-sm text-zinc-400">
        The link may be wrong, or the organization slug changed. Try the home
        page, the interactive demo, or sign in again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Home
        </Link>
        <Link
          href="/demo"
          className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
        >
          View demo
        </Link>
        <Link
          href="/sign-in"
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/25 hover:text-white"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
