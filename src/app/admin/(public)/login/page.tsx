import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { LoginForm } from "@/app/login/login-form";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { getServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getServerSession();
  if (session?.user?.id) {
    const [row] = await db
      .select({ platformAdmin: userTable.platformAdmin })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1);
    if (row?.platformAdmin) redirect("/admin");
    redirect("/login?notice=not_staff");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Staff sign in</h1>
          <p className="text-sm text-zinc-500">
            For Clona operators only. Clients use{" "}
            <Link href="/login" className="text-emerald-400 hover:underline">
              business sign in
            </Link>
            .
          </p>
        </div>
        <LoginForm nextPath="/admin" />
        <p className="text-center text-xs text-zinc-600">
          <Link href="/" className="hover:text-zinc-400">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
