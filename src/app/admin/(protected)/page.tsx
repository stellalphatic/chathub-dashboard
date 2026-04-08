import Link from "next/link";
import { listOrganizationsForAdmin } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
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
          <p className="mt-1 text-sm text-zinc-400 sm:text-base">
            Each client gets an org, dashboard access, and DB fields n8n must
            write to (see docs/SOP_DATABASE_N8N.md).
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/organizations/new">Add business</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {orgs.length === 0 ? (
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle>No businesses yet</CardTitle>
              <CardDescription>
                Create an organization to get <code className="text-emerald-400">organization.id</code>{" "}
                for Postgres rows and an ingest secret for the HTTP API path.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/organizations/new">Create organization</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          orgs.map((o) => (
            <Card
              key={o.id}
              className="hover:border-emerald-500/30 transition-colors"
            >
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">{o.name}</CardTitle>
                <CardDescription className="font-mono text-sm text-emerald-400/90 break-all">
                  {o.slug}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="secondary" size="sm" asChild className="w-full sm:w-auto">
                  <Link href={`/admin/organizations/${o.id}`}>Manage</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                  <Link href={`/app/${o.slug}`}>Client dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
