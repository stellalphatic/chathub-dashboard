import { redirect } from "next/navigation";

/**
 * Discreet staff entry point. Not linked from the marketing site.
 * Bookmark `/admin/access` and you get routed into Clerk's sign-in,
 * then into the staff console.
 */
export default function AdminAccess() {
  redirect("/sign-in?redirect_url=%2Fadmin");
}
