import Link from "next/link";
import { ArrowLeft, Mail, Shield } from "lucide-react";
import { listPlatformStaffForAdmin } from "@/app/admin/actions-users";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
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
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] transition-colors hover:text-[rgb(var(--fg))]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Businesses
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Shield className="h-5 w-5 text-[rgb(var(--accent))]" /> Platform staff
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--fg-muted))] sm:text-base">
          Everyone here can open <code>/admin</code> and any business dashboard. All staff
          accounts share the same console.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
              Staff count
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{staff.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
              Auto-promote rule
            </p>
            <p className="mt-1 text-sm text-[rgb(var(--fg))]">
              Emails in{" "}
              <code className="rounded bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[11px]">
                CHATHUB_PLATFORM_ADMIN_EMAILS
              </code>{" "}
              get staff access on first sign-in.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promote existing account</CardTitle>
          <CardDescription>
            The person must have signed in at least once (so their user row exists). Once you
            promote them, they can visit <code>/admin</code> immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromoteStaffForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Or promote via Clerk dashboard</CardTitle>
          <CardDescription>
            If you prefer not to touch the app, open the user in Clerk Dashboard →{" "}
            <strong>Public metadata</strong> → add <code>{`{ "platformAdmin": true }`}</code>.
            Next time they open a page we sync them as staff automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[rgb(var(--fg-muted))]">
          <p>
            Works with either <code>publicMetadata.platformAdmin</code>,{" "}
            <code>privateMetadata.platformAdmin</code>, or a{" "}
            <code>publicMetadata.role</code> of <code>&quot;admin&quot;</code> /{" "}
            <code>&quot;staff&quot;</code> / <code>&quot;platform_admin&quot;</code>.
          </p>
          <p>
            The three paths — env var list, form above, and Clerk metadata — all reach the same
            DB flag. Use whichever is fastest for the situation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current staff ({staff.length})</CardTitle>
          <CardDescription>
            Sorted by email. Contact your provider to demote/remove a user (manual DB edit
            for now).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
              No platform staff yet. Set{" "}
              <code>CHATHUB_PLATFORM_ADMIN_EMAILS</code> and sign in.
            </p>
          ) : (
            <ul className="divide-y divide-[rgb(var(--border))] rounded-xl border border-[rgb(var(--border))]">
              {staff.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full gradient-brand text-white">
                      {(s.name || s.email || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-[rgb(var(--fg))]">
                        {s.name || (
                          <span className="text-[rgb(var(--fg-subtle))]">(unnamed)</span>
                        )}
                      </p>
                      <p className="inline-flex items-center gap-1 truncate text-xs text-[rgb(var(--fg-muted))]">
                        <Mail className="h-3 w-3" /> {s.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="gradient" className="text-[10px]">
                      staff
                    </Badge>
                    <CopyButton value={s.id} label="ID" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
