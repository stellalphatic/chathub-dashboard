import { redirect } from "next/navigation";

/** Public self-registration is disabled; staff invites via Clerk from /admin. */
export default function RegisterPage() {
  redirect("/sign-in");
}
