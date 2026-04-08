import { redirect } from "next/navigation";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";

export default function DemoIndexPage() {
  redirect(`/demo/app/${DEMO_ORG_SLUG}`);
}
