import { redirect } from "next/navigation";

/** Staff sign-in now uses the same Clerk flow; role is enforced inside /admin. */
export default function AdminLoginRedirect() {
  redirect("/sign-in?redirect_url=%2Fadmin");
}
