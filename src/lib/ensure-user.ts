import { randomUUID } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, organizationMember, user as userTable } from "@/db/schema";
import { normalizeOrgMemberRole } from "@/lib/org-permissions";

/** Comma-separated list (env) of emails to auto-promote to platform admin. */
function adminEmailsFromEnv(): string[] {
  return (process.env.CHATHUB_PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Clerk can flag a user as platform admin via either `publicMetadata.platformAdmin = true`
 * or `privateMetadata.platformAdmin = true`. This lets you grant admin access from
 * the Clerk dashboard without redeploying / editing env vars.
 */
function hasAdminMetadata(
  pub: Record<string, unknown> | undefined,
  priv: Record<string, unknown> | undefined,
): boolean {
  const p1 = pub?.platformAdmin;
  const p2 = priv?.platformAdmin;
  if (p1 === true) return true;
  if (p2 === true) return true;
  if (typeof p1 === "string" && p1.toLowerCase() === "true") return true;
  if (typeof p2 === "string" && p2.toLowerCase() === "true") return true;
  // Optional role-based flag: "admin", "staff", "platform_admin"
  const role = (pub?.role ?? priv?.role) as unknown;
  if (typeof role === "string") {
    const v = role.toLowerCase();
    if (v === "admin" || v === "staff" || v === "platform_admin") return true;
  }
  return false;
}

type EnsureAppUserInput = {
  userId: string;
  email: string;
  name: string;
  publicMetadata: Record<string, unknown> | undefined;
  privateMetadata?: Record<string, unknown> | undefined;
};

/**
 * JIT sync between Clerk identity and our local `user` row.
 *
 * Idempotent; called on every authenticated request.
 *
 * Promotion to `platformAdmin` happens if ANY of these match:
 *   1. Email is in `CHATHUB_PLATFORM_ADMIN_EMAILS` env.
 *   2. Clerk user has `publicMetadata.platformAdmin = true` or `privateMetadata.platformAdmin = true`.
 *   3. Clerk user has `publicMetadata.role = "admin" | "staff" | "platform_admin"`.
 *
 * If the invitation email carried `publicMetadata.pendingOrgId` (and optional
 * `pendingOrgRole`), the user is added to that organization on first sign-in
 * (metadata is cleared after).
 */
export async function ensureAppUser(input: EnsureAppUserInput): Promise<void> {
  const emailLower = (input.email ?? "").trim().toLowerCase();

  const shouldBeAdminByEnv =
    emailLower.length > 0 && adminEmailsFromEnv().includes(emailLower);
  const shouldBeAdminByMeta = hasAdminMetadata(
    input.publicMetadata,
    input.privateMetadata,
  );
  const shouldBeAdmin = shouldBeAdminByEnv || shouldBeAdminByMeta;

  const fallbackEmail = emailLower || `${input.userId}@placeholder.invalid`;

  const [existing] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      platformAdmin: userTable.platformAdmin,
    })
    .from(userTable)
    .where(eq(userTable.id, input.userId))
    .limit(1);

  if (!existing) {
    try {
      await db.insert(userTable).values({
        id: input.userId,
        email: fallbackEmail,
        name: input.name || emailLower || "User",
        emailVerified: true,
        platformAdmin: shouldBeAdmin,
      });
    } catch (e) {
      // Another row with the same email already exists (edge case: same email across Clerk users).
      if ((e as { code?: string }).code !== "23505") throw e;
      console.warn(
        `[ensureAppUser] email ${emailLower} already bound to a different user id — skipping insert`,
      );
    }
  } else {
    const nextName = input.name || existing.name;
    const needsUpdate =
      existing.email !== fallbackEmail ||
      existing.name !== nextName ||
      (shouldBeAdmin && !existing.platformAdmin);
    if (needsUpdate) {
      await db
        .update(userTable)
        .set({
          email: fallbackEmail,
          name: nextName,
          platformAdmin: existing.platformAdmin || shouldBeAdmin,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, input.userId));
    }
  }

  // ── Invitation flow: attach to org if metadata carries pendingOrgId(s) ──
  // Supports either a single string or an array (for multi-org invites).
  const meta = input.publicMetadata ?? {};
  const rawOrgIds = (meta as Record<string, unknown>).pendingOrgId;
  const pendingOrgIds: string[] = Array.isArray(rawOrgIds)
    ? rawOrgIds.filter((x): x is string => typeof x === "string")
    : typeof rawOrgIds === "string"
      ? [rawOrgIds]
      : [];

  if (pendingOrgIds.length > 0) {
    for (const orgId of pendingOrgIds) {
      const [org] = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, orgId))
        .limit(1);
      if (!org) continue;
      const rawPendingRole = (meta as Record<string, unknown>).pendingOrgRole;
      const inviteRole =
        typeof rawPendingRole === "string"
          ? normalizeOrgMemberRole(rawPendingRole)
          : "agent";
      try {
        await db.insert(organizationMember).values({
          id: randomUUID(),
          organizationId: org.id,
          userId: input.userId,
          role: inviteRole,
          createdAt: new Date(),
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "23505") {
          console.warn("[ensureAppUser] org membership insert failed", e);
        }
      }
    }
    // Clear pending metadata so we don't re-run on every request
    try {
      const client = await clerkClient();
      const next = { ...(meta as Record<string, unknown>) };
      delete next.pendingOrgId;
      delete next.pendingOrgRole;
      await client.users.updateUserMetadata(input.userId, { publicMetadata: next });
    } catch (e) {
      console.warn("[ensureAppUser] failed to clear pendingOrgId metadata", e);
    }
  }
}
