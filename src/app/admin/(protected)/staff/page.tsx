import Link from "next/link";
import { listPlatformStaffForAdmin } from "@/app/admin/actions-users";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PromoteStaffForm } from "./promote-staff-form";

export default async function AdminStaffPage() {
  const staff = await listPlatformStaffForAdmin();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Businesses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Platform staff</h1>
        <p className="mt-1 text-sm text-zinc-400 sm:text-base">
          All staff accounts use the same staff console. Add colleagues by email after their user row exists
          (bootstrap, provisioned client login, or any successful sign-up).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grant access to another admin</CardTitle>
          <CardDescription>
            <code className="text-emerald-400/90">CHATHUB_PLATFORM_ADMIN_EMAILS</code> only auto-tags users{" "}
            <strong>at first sign-up</strong>. Use this form to promote anyone who already has an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromoteStaffForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current staff ({staff.length})</CardTitle>
          <CardDescription>Everyone listed here can open /admin and all business dashboards.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {staff.length === 0 ? (
              <li className="p-4 text-sm text-zinc-500">No platform staff yet.</li>
            ) : (
              staff.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{s.name}</p>
                    <p className="truncate text-zinc-500">{s.email}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-zinc-600">{s.id}</span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
