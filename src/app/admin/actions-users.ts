"use server";

import { randomUUID } from "crypto";
import { count, eq } from "drizzle-orm";
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

/** Create login credentials and attach user to an organization (staff-only). */
export async function provisionClientUserAction(input: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
}) {
  await requirePlatformAdmin();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (name.length < 1) return { error: "Name is required" };
  if (!email.includes("@")) return { error: "Invalid email" };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, input.organizationId))
    .limit(1);
  if (!org) return { error: "Organization not found" };

  const [existing] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  if (existing) {
    try {
      await db.insert(organizationMember).values({
        id: randomUUID(),
        organizationId: org.id,
        userId: existing.id,
        role: "member",
        createdAt: new Date(),
      });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "23505") {
        return { error: "That user is already a member of this organization." };
      }
      throw e;
    }
    revalidatePath("/admin");
    return {
      ok: true as const,
      mode: "linked_existing" as const,
      message:
        "User already existed; they have been added to this organization. Share password only if they never signed in before.",
    };
  }

  const origin = getAppOrigin();
  const res = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const raw = await res.text();
  let body: { message?: string; user?: { id: string } } = {};
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return {
      error:
        body.message ??
        `Could not create account (${res.status}). Check server logs.`,
    };
  }

  const [created] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  if (!created) {
    return { error: "Account created but user row not found; check database." };
  }

  await db.insert(organizationMember).values({
    id: randomUUID(),
    organizationId: org.id,
    userId: created.id,
    role: "member",
    createdAt: new Date(),
  });

  revalidatePath("/admin");
  return {
    ok: true as const,
    mode: "created" as const,
    message:
      "Account created. Send the client their email and password using a secure channel.",
  };
}

export async function countPlatformAdmins() {
  const [row] = await db
    .select({ c: count() })
    .from(userTable)
    .where(eq(userTable.platformAdmin, true));
  return Number(row?.c ?? 0);
}

/** One-time first staff account when no platform admins exist. */
export async function bootstrapFirstAdminAction(input: {
  token?: string;
  name: string;
  email: string;
  password: string;
}) {
  const admins = await countPlatformAdmins();
  if (admins > 0) {
    return { error: "Setup already completed. Sign in at /admin/login." };
  }

  const expected = process.env.CHATHUB_SETUP_TOKEN?.trim();
  if (process.env.NODE_ENV === "production" && !expected) {
    return {
      error:
        "Set CHATHUB_SETUP_TOKEN in the server environment, then open this page with ?token=…",
    };
  }
  if (expected && input.token?.trim() !== expected) {
    return { error: "Invalid setup token." };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (password.length < 10) {
    return { error: "Use a strong password (at least 10 characters)." };
  }

  const origin = getAppOrigin();
  const res = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let msg = `Sign-up failed (${res.status})`;
    try {
      const j = JSON.parse(raw) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* ignore */
    }
    return { error: msg };
  }

  await db
    .update(userTable)
    .set({ platformAdmin: true, updatedAt: new Date() })
    .where(eq(userTable.email, email));

  return { ok: true as const };
}
