import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  let notice: string | null = null;
  if (sp.notice === "not_staff") {
    notice =
      "That account is not a staff user. Business users sign in here; staff uses Staff console.";
  }
  if (sp.notice === "no_register") {
    notice = "Registration is disabled. Your administrator will send you login details.";
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Business sign in
          </h1>
          <p className="text-sm text-zinc-500">
            Use the email and password your administrator provided.
          </p>
        </div>
        {notice ? (
          <p
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        <LoginForm nextPath={sp.next} />
        <Button variant="outline" asChild className="w-full min-h-11 border-white/20 bg-white/5 hover:bg-white/10">
          <Link href="/demo">View demo dashboard (no sign-in)</Link>
        </Button>
        <p className="text-center text-sm text-zinc-600">
          Clona staff?{" "}
          <Link href="/admin/login" className="text-emerald-400 hover:underline">
            Staff console
          </Link>
        </p>
        <p className="text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
