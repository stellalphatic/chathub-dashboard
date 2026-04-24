import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureAppUser } from "@/lib/ensure-user";

/**
 * Uniform session for the rest of the app. Always prefer this over calling
 * Clerk directly, so the JIT sync (`ensureAppUser`) happens in one place.
 */
export async function getServerSession(): Promise<null | {
  user: { id: string; email: string; name: string };
}> {
  const { userId } = await auth();
  if (!userId) return null;
  const u = await currentUser();
  if (!u) return null;

  const email =
    u.primaryEmailAddress?.emailAddress ??
    u.emailAddresses[0]?.emailAddress ??
    "";
  const firstLast = [u.firstName, u.lastName].filter(Boolean).join(" ");
  const name = firstLast || u.username || email || "User";

  await ensureAppUser({
    userId,
    email,
    name,
    publicMetadata: u.publicMetadata as Record<string, unknown> | undefined,
    privateMetadata: u.privateMetadata as Record<string, unknown> | undefined,
  });

  return { user: { id: userId, email, name } };
}

export type AppSession = NonNullable<Awaited<ReturnType<typeof getServerSession>>>;
