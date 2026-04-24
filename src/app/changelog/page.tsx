import { ProsePage } from "@/components/marketing/prose-page";

export const metadata = { title: "Changelog — ChatHub" };

export default function ChangelogPage() {
  return (
    <ProsePage eyebrow="Changelog" title="What we shipped" subtitle="Selected highlights. Full list lives in the repo.">
      <h2>April 2026</h2>
      <ul>
        <li>Passwordless Clerk sign-in for staff + business users.</li>
        <li>S3 media archival — WhatsApp images and voice notes are now mirrored on ingest.</li>
        <li>Urdu-first voice transcription with Whisper prompt bias.</li>
        <li>Redis-backed bot config cache (60s), invalidated on persona edits.</li>
      </ul>

      <h2>March 2026</h2>
      <ul>
        <li>Per-organization "client config lock" toggle.</li>
        <li>BullMQ queue hardening — scheduled ticker moved in-process for reliability.</li>
        <li>Provider fallback router (Groq → Gemini → OpenAI) with per-attempt usage logs.</li>
      </ul>

      <h2>February 2026</h2>
      <ul>
        <li>Initial multi-tenant release with YCloud, Meta, and ManyChat webhooks.</li>
      </ul>
    </ProsePage>
  );
}
