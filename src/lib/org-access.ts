import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { organization, organizationMember, user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";
import {
  buildPermissionMap,
  canUseSection,
  normalizeOrgMemberRole,
  type OrgMemberRole,
  type OrgPermissionMap,
  type OrgSection,
} from "@/lib/org-permissions";

export type OrgAccess = {
  org: InferSelectModel<typeof organization>;
  userId: string;
  /** Platform staff — full access to every org + staff console. */
  isPlatformAdmin: boolean;
  /** Row in `organization_member` for this org. */
  isMember: boolean;
  /** Resolved role when `isMember`; null for platform-only visitors. */
  memberRole: OrgMemberRole | null;
  permissions: OrgPermissionMap;
  /** Invite / change roles / remove members (owner & org admin). */
  canManageOrgMembers: boolean;
};

const resolveOrgAccess = cache(async (orgSlug: string): Promise<OrgAccess | null> => {
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
    .select({ role: organizationMember.role })
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

  const memberRole = isMember ? normalizeOrgMemberRole(member?.role) : null;
  const { permissions, canManageOrgMembers } = buildPermissionMap(memberRole, {
    isPlatformAdmin,
    isOrgMember: isMember,
  });

  return {
    org,
    userId: session.user.id,
    isPlatformAdmin,
    isMember,
    memberRole,
    permissions,
    canManageOrgMembers,
  };
});

/**
 * Returns null if the user can't see the org.
 *
 * Access rules:
 *   - Platform admins: implicit access to every organization.
 *   - Organization members: explicit access via `organization_member`.
 *   - Everyone else: no access.
 */
export async function getOrgAccess(orgSlug: string): Promise<OrgAccess | null> {
  return resolveOrgAccess(orgSlug);
}

/** Server-component guard. Redirects on failure. */
export async function assertOrgMember(orgSlug: string): Promise<OrgAccess> {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/sign-in?redirect_url=%2Fapp");

  const access = await resolveOrgAccess(orgSlug);
  if (!access) {
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);
    if (!org) notFound();
    redirect("/app");
  }
  return access;
}

/**
 * Page-level guard: requires view or edit on a dashboard section.
 * Platform admins always pass.
 */
export async function assertOrgPage(
  orgSlug: string,
  section: OrgSection,
  mode: "view" | "edit",
): Promise<OrgAccess> {
  const access = await assertOrgMember(orgSlug);
  if (!canUseSection(access.permissions, section, mode)) {
    redirect(`/app/${orgSlug}/inbox?notice=no_access`);
  }
  return access;
}

export { canUseSection, type OrgSection, type OrgMemberRole, type OrgPermissionMap };
