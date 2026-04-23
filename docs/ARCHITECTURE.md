# ChatHub — Architecture

```
                               ┌─────────────────────────────┐
 Customer ────► Channel ────►  │  /api/webhooks/{ycloud,       │
(WA/IG/FB)       Provider      │      meta, manychat}          │
                               │  • HMAC verify                │
                               │  • idempotency via webhook_   │
                               │    event table                │
                               │  • ingestInboundMessage()     │
                               └─────┬─────────────────┬───────┘
                                     │ enqueue          │ persist
                                     ▼                 ▼
                            ┌──────────────┐    ┌──────────────┐
                            │ Redis +      │    │ Postgres     │
                            │ BullMQ queues│    │ (Supabase)   │
                            │ inbound-msg  │    │ customer /   │
                            │ llm-reply    │    │ conversation │
                            │ outbound-send│    │ / message    │
                            │ embed-doc    │    └──────────────┘
                            │ scheduled-tk │
                            │ broadcast    │
                            │ voice-trans  │
                            └──────┬───────┘
                                   │
                                   ▼
                      ┌─────────────────────────────┐
                      │  Worker process (Node +     │
                      │  BullMQ). One container,    │
                      │  horizontally scalable.     │
                      │                             │
                      │  inbound-message  ─► llm-reply ─► outbound-send
                      │                        │
                      │                        ▼
                      │               LLM router
                      │   Groq ─► Gemini ─► OpenAI (auto-fallback)
                      │                  │
                      │                  ▼
                      │          RAG retriever (Qdrant/Pinecone)
                      └─────────────────────────────┘
                                   │
                                   ▼
                      ┌──────────────────────────┐
                      │ Channel provider          │
                      │ (YCloud/Meta/ManyChat)    │
                      └──────────────────────────┘
```

## Components

**Next.js app** — Amplify (or Docker) hosts `/api/webhooks/*`, the business
dashboard (`/app`), and the staff console (`/admin`). Stateless; every request
hits Postgres and (for send/enqueue) Redis.

**Worker process** — `workers/index.ts`, runs on EC2 / Fargate next to Redis.
Same Postgres. Independent scaling. Handles long-running tasks that cannot
run inside the webhook request cycle:

| Queue | Concurrency | Role |
|---|---|---|
| `inbound-message` | 10/pod | Routes an inbound row to LLM or voice transcribe |
| `llm-reply` | 5/pod | Guardrails + RAG + router + send |
| `outbound-send` | 10/pod | Drains queued messages when the sync send hit a rate limit |
| `embed-document` | 2/pod | Parse → chunk → embed → Qdrant/Pinecone |
| `scheduled-ticker` | 1 | Every-minute cron → scans `scheduled_message` |
| `broadcast-runner` | 2/pod | Expands audience into scheduled rows |
| `voice-transcribe` | 4/pod | Groq Whisper → enqueue `llm-reply` |

**Redis** — BullMQ backbone + rate-limiting (per-org LLM, per-channel send).

**Postgres (Supabase)** — source of truth. All writes go here. Unique indices
on `message_org_provider_uidx` and `webhook_event_provider_ext_uidx` give us
exactly-once semantics at the storage layer.

**Vector DB** — Qdrant default, Pinecone adapter available. One collection /
namespace per organization → zero cross-tenant leak risk.

**LLM router** — Groq → Gemini → OpenAI. Fall-through on any network /
timeout / 5xx. Every attempt is recorded in `llm_usage` (success or fail).
Admins add/rotate keys from `/admin/llm` (encrypted with AES-256-GCM via
`ENCRYPTION_KEY`).

**Guardrails** — `src/lib/llm/guardrails.ts` runs deterministic filters on
**both** inbound and outbound messages:
- inbound: jailbreak / personal-attack detection → escalate flag
- outbound: credential leak scrubber, system-prompt leak detector,
  length cap, per-org denylist

**24-hour window** — `src/lib/window-24h.ts`. When the WhatsApp session window
is closed, freeform sends are blocked and the UI forces template mode. The
scheduled ticker enforces the same rule for scheduled / broadcast sends.

## Data model (new tables)

- `channel_connection` — encrypted provider credentials per org
- `conversation` — one row per (customer, channel)
- `message` — extended with channel, content_type, status, template id, …
- `handoff` — audit trail of bot↔human mode switches
- `bot_config` / `bot_faq` — assistant persona, escalation, RAG toggle, FAQ hot-path
- `document` / `document_chunk` — uploaded knowledge + chunk text (vectors live in Qdrant)
- `template` — approved WhatsApp/IG template catalog
- `scheduled_message` — future sends (locks + retry + status)
- `broadcast` — bulk send configurations
- `webhook_event` — idempotency for inbound providers
- `llm_usage` — per-call token + latency + provider + error (admin view)
- `platform_llm_credential` — encrypted platform-wide API keys
- `audit_log` — admin / tenant actions

## Horizontal scaling

- **Next.js** — stateless; Amplify auto-scales; or run `app` container behind ALB.
- **Worker** — `docker compose up --scale worker=N` or a Fargate service with
  desired count = N. Each worker pulls from Redis independently. Use `FOR
  UPDATE SKIP LOCKED` in the scheduled ticker to avoid double-claims.
- **Redis** — one box up to ~40k ops/sec. Above that switch to ElastiCache
  cluster mode.
- **Postgres** — Supabase pooler (pgbouncer / port 6543) handles tens of
  thousands of concurrent connections; writes bottleneck at a few thousand
  TPS on the default tier.
