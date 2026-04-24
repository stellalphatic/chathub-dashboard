import { ProsePage } from "@/components/marketing/prose-page";

export const metadata = { title: "Terms of service — ChatHub" };

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Terms of service" subtitle="The rules of the road for using ChatHub.">
      <p>
        By accessing or using ChatHub ("we", "us", "the Service"), you agree to these terms.
        If you don't agree, don't use the Service.
      </p>

      <h2>1. Accounts</h2>
      <p>
        Accounts are provisioned by our staff via invitation. You are responsible for
        activity on your account and must keep your credentials confidential.
      </p>

      <h2>2. Acceptable use</h2>
      <ul>
        <li>No spam, phishing, or unsolicited bulk messaging outside Meta/YCloud policies.</li>
        <li>No unlawful, fraudulent, or infringing content.</li>
        <li>No attempts to reverse-engineer, probe, or disrupt the Service.</li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You own the content you send to and receive through the Service. You grant us a
        limited licence to host, transmit, and process it solely to provide the Service.
      </p>

      <h2>4. Payment</h2>
      <p>
        Subscription fees are billed monthly in advance. Overage for LLM spend and message
        volume beyond your plan is billed in arrears.
      </p>

      <h2>5. Termination</h2>
      <p>
        Either party may terminate with 30 days' notice. We may suspend accounts for
        abuse, non-payment, or a security risk.
      </p>

      <h2>6. Disclaimers & liability</h2>
      <p>
        The Service is provided "as is". We exclude implied warranties to the maximum
        extent permitted by law. Our aggregate liability in any 12-month period is capped
        at fees you paid us in that period.
      </p>

      <h2>7. Governing law</h2>
      <p>
        These terms are governed by the laws of the jurisdiction of ChatHub's principal
        place of business.
      </p>
    </ProsePage>
  );
}
