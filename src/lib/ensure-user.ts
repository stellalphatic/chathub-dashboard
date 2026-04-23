import { randomUUID } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, organizationMember, user as userTable } from "@/db/schema";

/** Comma-separated list (env) of emails to auto-promote to platform admin. */
function adminEmailsFromEnv(): string[] {
  return (process.env.CHATHUB_PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type EnsureAppUserInput = {
  userId: string;
  email: string;
  name: string;
  publicMetadata: Record<string, unknown> | undefined;
};

/**
 * JIT sync between Clerk identity and our local `user` row.
 *
 * - Creates the row on first sign-in (id = Clerk userId).
 * - Auto-flags `platformAdmin` if email is in CHATHUB_PLATFORM_ADMIN_EMAILS.
 * - Attaches user to an org if the invitation carried `publicMetadata.pendingOrgId`
 *   (then clears that metadata so we don't re-run the link on every request).
 *
 * Safe to call on every authenticated request; it's idempotent and quick.
 */
export async function ensureAppUser(input: EnsureAppUserInput): Promise<void> {
  const emailLower = (input.email ?? "").trim().toLowerCase();
  const shouldBeAdmin = emailLower.length > 0 && adminEmailsFromEnv().includes(emailLower);
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
      // Email unique collision: another row exists with same email but different id.
      // Don't block sign-in; just warn. Admin must reconcile manually.
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

  // Invitation → org membership (single-use; cleared after success).
  const meta = input.publicMetadata ?? {};
  const pendingOrgId =
    typeof (meta as Record<string, unknown>).pendingOrgId === "string"
      ? ((meta as Record<string, unknown>).pendingOrgId as string)
      : null;
  if (pendingOrgId) {
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, pendingOrgId))
      .limit(1);
    if (org) {
      try {
        await db.insert(organizationMember).values({
          id: randomUUID(),
          organizationId: org.id,
          userId: input.userId,
          role: "member",
          createdAt: new Date(),
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "23505") {
          console.warn("[ensureAppUser] org membership insert failed", e);
        }
      }
    }
    try {
      const client = await clerkClient();
      const next = { ...(meta as Record<string, unknown>) };
      delete next.pendingOrgId;
      await client.users.updateUserMetadata(input.userId, { publicMetadata: next });
    } catch (e) {
      console.warn("[ensureAppUser] failed to clear pendingOrgId metadata", e);
    }
  }
}
