import { assertOrgMember } from "@/lib/org-access";
import { OrgNav } from "@/components/app/org-nav";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <p className="text-sm text-zinc-500 font-mono">{org.slug}</p>
        </div>
        <OrgNav orgSlug={orgSlug} />
      </div>
      {children}
    </div>
  );
}
