import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

/**
 * Users reach sign-up via an admin invitation link (ticket in the URL).
 * Clerk reads the `__clerk_ticket` query param and associates the invitation
 * automatically — we just render `<SignUp />`.
 */
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
            ChatHub
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Complete sign-up</h1>
          <p className="text-sm text-zinc-500">
            Accounts are created by your administrator. Follow the invite link from your email.
          </p>
        </div>
        <div className="flex justify-center">
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
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
