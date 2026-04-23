import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 safe-area-pb">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
            ChatHub
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Sign in
          </h1>
          <p className="text-sm text-zinc-500">
            Accounts are created by your administrator. Choose where you work.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button asChild className="w-full min-h-11 sm:w-auto">
            <Link href="/sign-in?redirect_url=%2Fapp">Business dashboard</Link>
          </Button>
          <Button variant="secondary" asChild className="w-full min-h-11 sm:w-auto">
            <Link href="/sign-in?redirect_url=%2Fadmin">Staff console</Link>
          </Button>
          <Button variant="outline" asChild className="w-full min-h-11 border-white/20 bg-white/5 hover:bg-white/10 sm:w-auto">
            <Link href="/demo">Preview demo UI</Link>
          </Button>
        </div>
        <p className="text-xs text-zinc-600">
          First deploy? Set <code className="text-emerald-400">CHATHUB_PLATFORM_ADMIN_EMAILS</code> to
          your email, then sign in — you become a platform admin automatically.
        </p>
      </div>
    </div>
  );
}
