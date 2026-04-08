import Link from "next/link";

/** Static UI preview — no auth or database. */
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="sticky top-0 z-50 border-b border-amber-500/30 bg-amber-950/90 px-4 py-2.5 text-center text-sm text-amber-100 backdrop-blur-md">
        <span className="font-medium">Demo preview</span>
        <span className="text-amber-200/80">
          {" "}
          — sample data only.{" "}
          <Link
            href="/login"
            className="font-medium text-white underline decoration-amber-400/80 underline-offset-2 hover:text-amber-50"
          >
            Sign in
          </Link>{" "}
          for your real workspace.
        </span>
      </div>
      {children}
    </div>
  );
}
