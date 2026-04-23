import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

/** Clerk hosts the sign-in UI. Email code / magic link / SSO are all configured in the Clerk dashboard. */
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
            ChatHub
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-zinc-500">
            Use the email your administrator invited. Platform staff use the same sign-in.
          </p>
        </div>
        <div className="flex justify-center">
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
        </div>
        <p className="text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
