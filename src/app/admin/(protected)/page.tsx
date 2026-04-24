import Link from "next/link";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { listOrganizationsForAdmin } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminHomePage() {
  const orgs = await listOrganizationsForAdmin();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Businesses
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--fg-muted))] sm:text-base">
            Each business is a fully isolated tenant — channels, bot, customers, analytics.
            Click one to manage integrations and access.
          </p>
        </div>
        <Button asChild variant="gradient" className="w-full sm:w-auto">
          <Link href="/admin/organizations/new">
            <Plus className="h-4 w-4" /> New business
          </Link>
        </Button>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No businesses yet</CardTitle>
            <CardDescription>
              Create an organization to get <code>organization.id</code> for any external
              integrations (n8n, Zapier, custom backends) and an ingest secret for the HTTP API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="gradient">
              <Link href="/admin/organizations/new">
                <Plus className="h-4 w-4" /> Create first business
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((o) => (
            <Link key={o.id} href={`/admin/organizations/${o.id}`} className="fade-up-item">
              <Card interactive className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-semibold tracking-tight">{o.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-[rgb(var(--fg-subtle))]">
                      {o.slug}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-[rgb(var(--fg-muted))]">
                    <span>Manage</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          <Link href="/admin/organizations/new" className="fade-up-item">
            <Card interactive className="h-full border-dashed">
              <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-muted))]">
                  <Plus className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium">Add business</p>
                <p className="text-xs text-[rgb(var(--fg-subtle))]">Slug + ingest secret</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
