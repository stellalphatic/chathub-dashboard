# Guardrails & safety

Every customer message and every bot response passes through
`src/lib/llm/guardrails.ts` on its way in and out. These are deterministic
filters — no extra LLM call — so they add ~0 ms of latency.

## Inbound (from customer)

1. Empty or >4000 chars → truncate or drop.
2. Jailbreak patterns ("ignore previous instructions", "reveal system
   prompt", "developer mode", …) → message is STILL delivered to the LLM but
   the system prompt is kept intact and the output is aggressively scrubbed.
3. Personal-attack / abuse patterns → auto-escalate to human; bot sends a
   canned "handing over" message.
4. Escalation keywords (configurable per org) → hand off.
5. Voice notes → transcribed first, then pass through the same filter.

## Outbound (to customer)

1. Scrub any string resembling an API key (`sk-…`, `AIzaSy…`, `gsk_…`).
2. Reject anything that looks like a leaked system prompt (`[[SYSTEM]]`,
   `system prompt:`).
3. Reject explicit profanity.
4. Per-org denylist (coming in Phase 2).
5. Length cap — WhatsApp 3800, Instagram 950.

## 24-hour window (WhatsApp)

`src/lib/window-24h.ts`. If the last inbound from the customer is older than
24 hours, the UI and the scheduler FORCE a template send. Freeform sends are
blocked client-side AND in `queueOutboundMessage`.

## Cross-tenant isolation

- Every DB query is `WHERE organization_id = ?`.
- Vector DB uses one collection per org (Qdrant) or a namespace per org
  (Pinecone).
- Encryption key is single-tenant at the platform level BUT every credential
  blob contains no org info, so even if one blob leaks, nothing else does.
- Webhook verification: HMAC from the provider + org lookup by
  `channel_connection.externalId`. Random traffic can't fake an org.

## Rate limits

- Per-org LLM calls: `LLM_RATE_PER_MIN` (default 240).
- Per-channel-connection send: `CHANNEL_SEND_PER_SEC` (default 40, safely
  below Meta's 80/s).
- Worker queues have retry/backoff with exponential delay.

## What's NOT yet included (Phase 2 notes)

- OpenAI Moderation API call on the user's text before replying (adds ~150 ms).
- Content-provenance watermarks on outbound.
- Per-tenant KMS (AWS KMS) so even Clona staff can't decrypt a tenant's
  secrets without a key-use event.
- Automated re-encryption script for `ENCRYPTION_KEY` rotation.
