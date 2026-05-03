"use server";

import { randomBytes, randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  organization,
  organizationMember,
  user as userTable,
} from "@/db/schema";
import { ORG_MEMBER_ROLES, type OrgMemberRole } from "@/lib/org-permissions";
import { getServerSession } from "@/lib/session";

async function requirePlatformAdmin() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const [row] = await db
    .select({ platformAdmin: userTable.platformAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!row?.platformAdmin) {
    throw new Error("Forbidden");
  }
  return session;
}

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createOrganizationAction(input: {
  name: string;
  slug: string;
}) {
  await requirePlatformAdmin();
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  if (name.length < 2) {
    return { error: "Name is too short" };
  }
  if (!slugRegex.test(slug)) {
    return {
      error:
        "Slug must be lowercase letters, numbers, and hyphens (e.g. modern-motors).",
    };
  }

  const ingestSecret = randomBytes(32).toString("hex");
  const id = randomUUID();
  const now = new Date();

  try {
    await db.insert(organization).values({
      id,
      name,
      slug,
      ingestSecret,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return { error: "That slug is already taken." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return {
    ok: true as const,
    ingestSecret,
    slug,
    name,
  };
}

export async function addOrganizationMemberAction(input: {
  organizationId: string;
  email: string;
  /** Defaults to `agent` when omitted. */
  role?: string;
}) {
  await requirePlatformAdmin();
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) {
    return { error: "Invalid email" };
  }
  const rawRole = (input.role ?? "agent").trim().toLowerCase();
  if (!ORG_MEMBER_ROLES.includes(rawRole as OrgMemberRole)) {
    return { error: "Invalid role." };
  }
  const role = rawRole as OrgMemberRole;

  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, input.organizationId))
    .limit(1);
  if (!org) {
    return { error: "Organization not found" };
  }

  const [u] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (!u) {
    return {
      error:
        "No account with that email. Create a client login on the business page first, or use another email.",
    };
  }

  try {
    await db.insert(organizationMember).values({
      id: randomUUID(),
      organizationId: org.id,
      userId: u.id,
      role,
      createdAt: new Date(),
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return { error: "User is already a member of this organization." };
    }
    throw e;
  }

  revalidatePath("/admin");
  return { ok: true as const };
}

export async function listOrganizationsForAdmin() {
  await requirePlatformAdmin();
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .orderBy(asc(organization.name));
}

export async function getOrganizationAdmin(orgId: string) {
  await requirePlatformAdmin();
  const [row] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  return row ?? null;
}

/** When true, business users cannot edit bot persona / FAQs / channels; platform staff still can. */
export async function setOrganizationClientConfigLockAction(input: {
  organizationId: string;
  locked: boolean;
}) {
  await requirePlatformAdmin();
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, input.organizationId))
    .limit(1);
  if (!org) {
    return { error: "Organization not found" };
  }
  const prev =
    org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  const next = { ...prev, clientConfigReadOnly: input.locked };
  await db
    .update(organization)
    .set({ settings: next, updatedAt: new Date() })
    .where(eq(organization.id, org.id));
  revalidatePath(`/admin/organizations/${org.id}`);
  revalidatePath("/admin");
  return { ok: true as const };
}
