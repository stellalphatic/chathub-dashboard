import { ProsePage } from "@/components/marketing/prose-page";

export const metadata = { title: "Security — ChatHub" };

export default function SecurityPage() {
  return (
    <ProsePage eyebrow="Legal" title="Security" subtitle="How we protect your data and your customers'.">
      <h2>Encryption</h2>
      <ul>
        <li>TLS 1.2+ in transit everywhere (Amplify, Supabase, EC2 workers).</li>
        <li>AES-256-GCM at rest for channel provider API keys and LLM credentials.</li>
        <li>Key rotation support with `ENCRYPTION_KEY_PREVIOUS` for zero-downtime re-encryption.</li>
      </ul>

      <h2>Access control</h2>
      <ul>
        <li>Clerk email-OTP sign-in — no shared passwords.</li>
        <li>Per-tenant data isolation enforced in every query.</li>
        <li>Platform-admin role separate from business users.</li>
      </ul>

      <h2>Infrastructure</h2>
      <ul>
        <li>Postgres hosted on Supabase with point-in-time recovery.</li>
        <li>Object storage in a private S3 bucket — signed URLs only.</li>
        <li>Background workers on EC2 inside a private security group.</li>
      </ul>

      <h2>Responsible disclosure</h2>
      <p>
        Found a vulnerability? Please email <a href="mailto:security@clona.site">security@clona.site</a>.
        We acknowledge within 2 business days and do not pursue reporters acting in good
        faith.
      </p>
    </ProsePage>
  );
}
