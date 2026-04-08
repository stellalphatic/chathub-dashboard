import { redirect } from "next/navigation";

/** Public self-registration is disabled; staff provisions clients from /admin. */
export default function RegisterPage() {
  redirect("/login?notice=no_register");
}
