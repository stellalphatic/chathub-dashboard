import Link from "next/link";
import { CreateOrgForm } from "./create-org-form";

export default function NewOrganizationPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        ← Back to businesses
      </Link>
      <CreateOrgForm />
    </div>
  );
}
