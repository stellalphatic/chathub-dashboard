import { NextResponse } from "next/server";
import { getOrgAccess } from "@/lib/org-access";

export const dynamic = "force-dynamic";

/**
 * JSON for the app shell sidebar: which nav sections the signed-in user may see.
 * Requires Clerk session (middleware). Safe to cache briefly on the client only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug query parameter required" }, { status: 400 });
  }
  const access = await getOrgAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    permissions: access.permissions,
    canManageOrgMembers: access.canManageOrgMembers,
    memberRole: access.memberRole,
    isPlatformAdmin: access.isPlatformAdmin,
  });
}
