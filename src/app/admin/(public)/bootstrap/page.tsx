import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { countPlatformAdmins } from "@/app/admin/actions-users";
import { BootstrapForm } from "./bootstrap-form";

export const dynamic = "force-dynamic";

export default async function AdminBootstrapPage() {
  const admins = await countPlatformAdmins();
  if (admins > 0) {
    redirect("/admin/login");
  }

  if (
    process.env.NODE_ENV === "production" &&
    !process.env.CHATHUB_SETUP_TOKEN?.trim()
  ) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <Suspense
          fallback={
            <p className="text-center text-sm text-zinc-500">Loading…</p>
          }
        >
          <BootstrapForm />
        </Suspense>
        <p className="text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
