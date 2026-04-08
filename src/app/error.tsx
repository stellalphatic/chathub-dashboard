"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400/90">
        Something went wrong
      </p>
      <h1 className="max-w-md text-2xl font-semibold text-white sm:text-3xl">
        We couldn&apos;t render this page
      </h1>
      <p className="max-w-md text-sm text-zinc-400">
        {error.message ||
          "An unexpected error occurred. If you just deployed, check database URL and environment variables on your host."}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-zinc-600">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/25 hover:text-white"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
