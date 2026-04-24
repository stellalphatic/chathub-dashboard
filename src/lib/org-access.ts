import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { organization, organizationMember, user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export type OrgAccess = {
  org: InferSelectModel<typeof organization>;
  userId: string;
  /** True when the user is a platform admin (staff); they implicitly have access to every org. */
  isPlatformAdmin: boolean;
  /** True when the user is a direct `organization_member` — regular business user. */
  isMember: boolean;
};

/**
 * Returns null if the user can't see the org.
 *
 * Access rules:
 *   - Platform admins: implicit access to every organization.
 *   - Organization members: explicit access via `organization_member`.
 *   - Everyone else: no access.
 */
export async function getOrgAccess(orgSlug: string): Promise<OrgAccess | null> {
  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);
  if (!org) return null;

  const [u] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  const isPlatformAdmin = Boolean(u?.platformAdmin);

  const [member] = await db
    .select({ id: organizationMember.id })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, org.id),
        eq(organizationMember.userId, session.user.id),
      ),
    )
    .limit(1);
  const isMember = Boolean(member);

  if (!isPlatformAdmin && !isMember) return null;
  return { org, userId: session.user.id, isPlatformAdmin, isMember };
}

/** Server-component guard. Redirects on failure. */
export async function assertOrgMember(orgSlug: string): Promise<OrgAccess> {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/sign-in?redirect_url=%2Fapp");

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);
  if (!org) notFound();

  const [u] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  const isPlatformAdmin = Boolean(u?.platformAdmin);

  const [member] = await db
    .select({ id: organizationMember.id })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, org.id),
        eq(organizationMember.userId, session.user.id),
      ),
    )
    .limit(1);
  const isMember = Boolean(member);

  if (!isPlatformAdmin && !isMember) redirect("/app");

  return { org, userId: session.user.id, isPlatformAdmin, isMember };
}

/**
 * Strict guard for staff-only configuration pages (Bot, Knowledge, Channels,
 * Templates, Broadcasts). Business users are redirected to the inbox.
 */
export async function assertOrgAdmin(orgSlug: string): Promise<OrgAccess> {
  const access = await assertOrgMember(orgSlug);
  if (!access.isPlatformAdmin) {
    redirect(`/app/${orgSlug}/inbox?notice=staff_only`);
  }
  return access;
}
