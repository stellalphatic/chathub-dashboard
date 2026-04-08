import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { organization, organizationMember } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export type OrgAccess = {
  org: InferSelectModel<typeof organization>;
  userId: string;
};

/** Returns null if unauthenticated, org missing, or user is not a member. */
export async function getOrgAccess(orgSlug: string): Promise<OrgAccess | null> {
  const session = await getServerSession();
  if (!session?.user?.id) return null;

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);
  if (!org) return null;

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

  if (!member) return null;
  return { org, userId: session.user.id };
}

/** For server components: login → org 404 → member redirect, same as org layout. */
export async function assertOrgMember(orgSlug: string): Promise<OrgAccess> {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);
  if (!org) notFound();

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

  if (!member) redirect("/app");

  return { org, userId: session.user.id };
}
