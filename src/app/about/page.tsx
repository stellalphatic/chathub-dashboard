import { ProsePage } from "@/components/marketing/prose-page";

export const metadata = { title: "About — ChatHub" };

export default function AboutPage() {
  return (
    <ProsePage
      eyebrow="About"
      title="We build customer-conversation infrastructure."
      subtitle="ChatHub is a small engineering team shipping a multi-tenant agent platform for SMBs and enterprise brands."
    >
      <p>
        We started ChatHub because every business we talked to was stitching together a
        different pile of tools — one for WhatsApp, another for Instagram, a third for the
        AI, and a CRM on top. Nothing worked together, everything leaked data, and nobody
        could explain why replies went out at 3am.
      </p>
      <p>
        Our answer: one tenant-aware platform with a proper inbox, CRM, templates,
        broadcasts, and an AI agent that stays on brand — built on the Meta, YCloud and
        ManyChat APIs you already use.
      </p>

      <h2>Principles</h2>
      <ul>
        <li>Security first. Secrets are encrypted, roles are explicit, audit logs are honest.</li>
        <li>Humans stay in the loop. The bot hands off the moment it isn't sure.</li>
        <li>Honest analytics. We surface costs and errors, not vanity metrics.</li>
      </ul>

      <h2>Get in touch</h2>
      <p>
        Questions, partnerships, or just want a walkthrough?{" "}
        <a href="/contact">Say hello</a>.
      </p>
    </ProsePage>
  );
}
