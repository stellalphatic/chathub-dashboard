import { ProsePage } from "@/components/marketing/prose-page";

export const metadata = { title: "Privacy policy — ChatHub" };

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Legal" title="Privacy policy" subtitle="How we collect, use, and safeguard your data.">
      <p>
        This policy explains what personal information ChatHub collects from business
        customers and their end-users, how we use it, who we share it with, and the rights
        you have over it.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account data</strong> — email, name, authentication identifiers.</li>
        <li><strong>Business data</strong> — organization name, API keys for channel providers (stored AES-256-GCM encrypted at rest).</li>
        <li><strong>Conversations</strong> — inbound and outbound messages, media, and metadata you and your customers exchange over WhatsApp, Instagram, and Messenger.</li>
        <li><strong>Usage telemetry</strong> — request counts, token spend, latency per LLM call, error rates.</li>
      </ul>

      <h2>2. How we use the data</h2>
      <ul>
        <li>To operate the service — routing messages, generating replies, serving your dashboard.</li>
        <li>To enforce Meta's 24-hour customer-service window and template policy.</li>
        <li>To produce the analytics you see in your dashboard.</li>
        <li>To maintain security, detect abuse, and comply with legal obligations.</li>
      </ul>

      <h2>3. Processors we use</h2>
      <p>
        We share the minimum personal information necessary with the following sub-processors:
      </p>
      <ul>
        <li>Clerk — authentication.</li>
        <li>Supabase — Postgres hosting (EU / US region of your choice).</li>
        <li>AWS — app hosting, workers, object storage.</li>
        <li>OpenAI, Groq, Google — large language model inference.</li>
        <li>YCloud, Meta (WhatsApp / IG / FB), ManyChat — message delivery.</li>
      </ul>

      <h2>4. Retention</h2>
      <p>
        Conversations are retained until the business owner deletes them. Platform logs are
        kept for up to 90 days. Account data is deleted within 30 days of a deletion
        request.
      </p>

      <h2>5. Your rights</h2>
      <p>
        Depending on your jurisdiction, you may request access to, correction, or deletion
        of your personal data. Contact <a href="/contact">our privacy team</a>.
      </p>

      <h2>6. Changes</h2>
      <p>
        We'll post updates to this page and notify account owners of material changes at
        least 30 days in advance.
      </p>
    </ProsePage>
  );
}
