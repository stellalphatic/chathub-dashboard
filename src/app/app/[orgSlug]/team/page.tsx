import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMember, user } from "@/db/schema";
import { assertOrgMember } from "@/lib/org-access";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { org } = await assertOrgMember(orgSlug);

  const members = await db
    .select({
      name: user.name,
      email: user.email,
      role: organizationMember.role,
    })
    .from(organizationMember)
    .innerJoin(user, eq(organizationMember.userId, user.id))
    .where(eq(organizationMember.organizationId, org.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Team</h2>
        <p className="text-sm text-zinc-400">
          New members are provisioned by a Clona admin from the staff console.
          Reach out to your account manager to add an agent.
        </p>
      </div>
      <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {members.length === 0 ? (
          <li className="p-3 text-sm text-zinc-500">No members yet.</li>
        ) : (
          members.map((m) => (
            <li
              key={m.email}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-white">{m.name}</p>
                <p className="truncate text-xs text-zinc-500">{m.email}</p>
              </div>
              <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
                {m.role}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
