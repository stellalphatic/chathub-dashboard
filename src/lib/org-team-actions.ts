"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { organizationMember, user as userTable } from "@/db/schema";
import { getOrgAccess } from "@/lib/org-access";
import {
  isOrgOwnerOrAdminRole,
  normalizeOrgMemberRole,
  ORG_MEMBER_ROLES,
  type OrgMemberRole,
} from "@/lib/org-permissions";
import { getServerSession } from "@/lib/session";

async function isPlatformStaff(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return Boolean(row?.platformAdmin);
}

async function assertMemberManager(orgSlug: string): Promise<
  | { ok: true; organizationId: string; actorUserId: string }
  | { ok: false; error: string }
> {
  const session = await getServerSession();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  const actorUserId = session.user.id;
  if (await isPlatformStaff(actorUserId)) {
    const access = await getOrgAccess(orgSlug);
    if (!access) return { ok: false, error: "Organization not found" };
    return { ok: true, organizationId: access.org.id, actorUserId };
  }
  const access = await getOrgAccess(orgSlug);
  if (!access) return { ok: false, error: "Unauthorized" };
  if (!access.canManageOrgMembers) {
    return { ok: false, error: "Only owners and admins can change team membership." };
  }
  return { ok: true, organizationId: access.org.id, actorUserId };
}

const roleSchema = z
  .string()
  .refine((r): r is OrgMemberRole => ORG_MEMBER_ROLES.includes(r as OrgMemberRole));

export async function updateOrgMemberRoleAction(input: {
  orgSlug: string;
  targetUserId: string;
  role: string;
}): Promise<{ ok: true } | { error: string }> {
  const gate = await assertMemberManager(input.orgSlug);
  if (!gate.ok) return { error: gate.error };
  const parsed = roleSchema.safeParse(input.role);
  if (!parsed.success) return { error: "Invalid role." };
  const nextRole = parsed.data;

  const [row] = await db
    .select({ id: organizationMember.id, role: organizationMember.role })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, gate.organizationId),
        eq(organizationMember.userId, input.targetUserId),
      ),
    )
    .limit(1);
  if (!row) return { error: "Member not found in this organization." };

  const prev = normalizeOrgMemberRole(row.role);
  if (isOrgOwnerOrAdminRole(prev) && !isOrgOwnerOrAdminRole(nextRole)) {
    const admins = await db
      .select({ userId: organizationMember.userId })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, gate.organizationId),
          inArray(organizationMember.role, ["owner", "admin"]),
        ),
      );
    if (admins.length === 1 && admins[0]!.userId === input.targetUserId) {
      return {
        error: "Can't remove the last owner/admin from the business. Promote someone else first.",
      };
    }
  }

  await db
    .update(organizationMember)
    .set({ role: nextRole })
    .where(eq(organizationMember.id, row.id));

  revalidatePath(`/app/${input.orgSlug}/team`);
  revalidatePath(`/admin`);
  revalidatePath(`/admin/organizations/${gate.organizationId}`);
  return { ok: true };
}

export async function removeOrgMemberAction(input: {
  orgSlug: string;
  targetUserId: string;
}): Promise<{ ok: true } | { error: string }> {
  const gate = await assertMemberManager(input.orgSlug);
  if (!gate.ok) return { error: gate.error };

  const [target] = await db
    .select({ role: organizationMember.role })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, gate.organizationId),
        eq(organizationMember.userId, input.targetUserId),
      ),
    )
    .limit(1);
  if (!target) return { error: "Member not found." };

  if (isOrgOwnerOrAdminRole(normalizeOrgMemberRole(target.role))) {
    const admins = await db
      .select({ userId: organizationMember.userId })
      .from(organizationMember)
      .where(
        and(
          eq(organizationMember.organizationId, gate.organizationId),
          inArray(organizationMember.role, ["owner", "admin"]),
        ),
      );
    if (admins.length === 1 && admins[0]!.userId === input.targetUserId) {
      return {
        error: "Can't remove the last owner/admin. Promote another member first.",
      };
    }
  }

  await db
    .delete(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, gate.organizationId),
        eq(organizationMember.userId, input.targetUserId),
      ),
    );

  revalidatePath(`/app/${input.orgSlug}/team`);
  revalidatePath(`/admin`);
  revalidatePath(`/admin/organizations/${gate.organizationId}`);
  return { ok: true };
}
