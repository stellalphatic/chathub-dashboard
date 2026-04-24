import { Badge } from "@/components/ui/badge";
import { assertOrgMember } from "@/lib/org-access";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const locked =
    org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
      ? Boolean((org.settings as Record<string, unknown>).clientConfigReadOnly)
      : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--fg))]">
              {org.name}
            </h1>
            {locked && (
              <Badge variant="warning" className="text-[10px]">
                Config locked by staff
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[rgb(var(--fg-subtle))] font-mono">
            {org.slug}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
