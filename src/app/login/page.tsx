import { redirect } from "next/navigation";

/** Legacy route — Clerk now handles sign-in at /sign-in. */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") ? sp.next : "/app";
  const redirectUrl = `/sign-in?redirect_url=${encodeURIComponent(next)}`;
  redirect(redirectUrl);
}
