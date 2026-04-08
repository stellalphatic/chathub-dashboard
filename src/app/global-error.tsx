"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold text-white">ChatHub</h1>
          <p className="max-w-md text-sm text-zinc-400">
            A critical error occurred. Please reload the page. If this persists
            after deploy, verify your hosting configuration (e.g. Netlify Next.js
            plugin) and server environment.
          </p>
          <p className="font-mono text-xs text-zinc-600">{error.message}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
