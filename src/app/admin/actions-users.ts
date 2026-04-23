"use server";

import { randomUUID } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  organization,
  organizationMember,
  user as userTable,
} from "@/db/schema";
import { getAppOrigin } from "@/lib/app-origin";
import { getServerSession } from "@/lib/session";

async function requirePlatformAdmin() {
  const session = await getServerSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const [row] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!row?.platformAdmin) throw new Error("Forbidden");
  return session;
}

/**
 * Invite a business user to an org via Clerk.
 *
 * - If the email already has a Clerk account: we just link them (or no-op).
 * - Otherwise: create a Clerk invitation carrying `publicMetadata.pendingOrgId`.
 *   When the invitee clicks the email, finishes sign-up at `/sign-up`, and
 *   hits any authenticated route, `ensureAppUser()` creates the local user
 *   row AND the organization_member row automatically.
 */
export async function inviteClientUserAction(input: {
  organizationId: string;
  email: string;
}) {
  await requirePlatformAdmin();

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Invalid email" };

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, input.organizationId))
    .limit(1);
  if (!org) return { error: "Organization not found" };

  // Case 1: user row already exists locally — link membership directly.
  const [localUser] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (localUser) {
    try {
      await db.insert(organizationMember).values({
        id: randomUUID(),
        organizationId: org.id,
        userId: localUser.id,
        role: "member",
        createdAt: new Date(),
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        return { error: "That user is already a member of this organization." };
      }
      throw e;
    }
    revalidatePath("/admin");
    revalidatePath(`/admin/organizations/${org.id}`);
    return {
      ok: true as const,
      mode: "linked_existing" as const,
      message:
        "User already existed; they have been added to this organization. They can sign in immediately.",
    };
  }

  // Case 2: check Clerk for an existing account under this email.
  const client = await clerkClient();
  const existingClerkUsers = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  if (existingClerkUsers.totalCount > 0) {
    const clerkUser = existingClerkUsers.data[0];
    await db
      .insert(userTable)
      .values({
        id: clerkUser.id,
        email,
        name:
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          email,
        emailVerified: true,
      })
      .onConflictDoNothing({ target: userTable.id });
    try {
      await db.insert(organizationMember).values({
        id: randomUUID(),
        organizationId: org.id,
        userId: clerkUser.id,
        role: "member",
        createdAt: new Date(),
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        return { error: "That user is already a member of this organization." };
      }
      throw e;
    }
    revalidatePath("/admin");
    revalidatePath(`/admin/organizations/${org.id}`);
    return {
      ok: true as const,
      mode: "linked_existing" as const,
      message: "User already had a Clerk account — linked to this business.",
    };
  }

  // Case 3: fresh invitation via Clerk.
  const origin = getAppOrigin();
  try {
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${origin}/sign-up`,
      publicMetadata: { pendingOrgId: org.id },
      notify: true,
    });
  } catch (e) {
    console.error("[inviteClientUserAction] clerk invitation failed", e);
    const message =
      e instanceof Error
        ? e.message
        : "Could not send Clerk invitation; check server logs.";
    return { error: message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/organizations/${org.id}`);
  return {
    ok: true as const,
    mode: "invited" as const,
    message:
      "Invitation email sent. When they accept, they are automatically added to this business.",
  };
}

export async function countPlatformAdmins() {
  const [row] = await db
    .select({ c: count() })
    .from(userTable)
    .where(eq(userTable.platformAdmin, true));
  return Number(row?.c ?? 0);
}

export async function listPlatformStaffForAdmin() {
  await requirePlatformAdmin();
  return db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.platformAdmin, true))
    .orderBy(asc(userTable.email));
}

/**
 * Grant staff console access to an existing account (same dashboard as other admins).
 *
 * Requires that the user has already signed in at least once so our local
 * `user` row exists. Otherwise we can't promote — ask them to sign in first,
 * or add their email to CHATHUB_PLATFORM_ADMIN_EMAILS which auto-promotes on
 * first sign-in.
 */
export async function promotePlatformStaffByEmailAction(input: { email: string }) {
  await requirePlatformAdmin();
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) {
    return { error: "Invalid email" };
  }
  const [u] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (!u) {
    return {
      error:
        "No user with that email yet. Ask them to sign in once (so the row is created), or add the email to CHATHUB_PLATFORM_ADMIN_EMAILS and redeploy.",
    };
  }
  await db
    .update(userTable)
    .set({ platformAdmin: true, updatedAt: new Date() })
    .where(eq(userTable.id, u.id));
  revalidatePath("/admin/staff");
  revalidatePath("/admin");
  return { ok: true as const };
}
