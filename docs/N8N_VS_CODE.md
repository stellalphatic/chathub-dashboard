# n8n vs code — why ChatHub is built in code

A question that comes up every time you sketch an omni-channel bot.
Below is the honest comparison based on what ChatHub needs.

## What ChatHub needs

1. Tenant-isolated hot path: webhook → LLM → reply in ~1-3 seconds.
2. Per-tenant credentials (WhatsApp + IG + FB + LLM keys).
3. Strict guardrails on inbound AND outbound (jailbreak, credential leaks,
   length caps, profanity, 24-hour window policy).
4. LLM fallback chain Groq → Gemini → OpenAI.
5. RAG retrieval against a per-tenant Qdrant collection.
6. Scheduled sends and broadcasts (rate-limited, 24h-safe).
7. Observability: LLM tokens, latency, errors, cost per tenant.
8. Horizontal scale from 100 to 1M messages/month.

## Scoreboard

| Dimension | Code (what we shipped) | n8n |
|---|---|---|
| Per-tenant isolation | Baked into every query (`WHERE organizationId=…`) and vector namespace. Enforced at the schema level. | Each workflow is a single "all-tenants" box unless you duplicate one flow per customer → unmaintainable past 5 tenants. |
| Hot-path latency | Webhook → ingest (~40 ms) → enqueue (1 ms) → worker → LLM (~700-1500 ms Groq) → send (~300 ms). **End-to-end ~1-3s**. | Webhook → workflow start (~150-500 ms overhead per run) → HTTP node to LLM → IF node for routing → reply → HTTP send. 1.5-5s typical, spikes under load. |
| Guardrails | Typed TypeScript (`inspectInbound` / `inspectOutbound`), unit-testable, versioned in git. | "Function" nodes holding JS; no type checking; easy to miss edge cases across 20 copies of the flow. |
| LLM fallback | Single router class with retries + usage logging. | Chain of IF/Try-Catch nodes that you have to clone into every flow. |
| RAG | Deterministic code path (embed → query → compose). | Doable with HTTP nodes; hard to encode per-tenant namespaces without N workflows. |
| Scheduling + 24h rule | `scheduled_message` table + `FOR UPDATE SKIP LOCKED` worker → exactly-once. | n8n Cron + WAIT nodes; no real concurrency control → duplicates happen. |
| Scalability | Any number of worker replicas sharing Redis. 1 EC2 box = ~200k msgs/mo. | n8n workers exist but each workflow execution costs tens of MB and Node cycles. Beyond a few hundred concurrent you need a cluster. |
| Cost at scale | Cheap: 1 EC2 + Supabase + LLM token costs. | Adds ~$40-200/mo per worker node just to keep n8n alive, plus your LLM bill. |
| Observability | Every LLM call is a DB row (`llm_usage`). Prometheus-ready. | n8n's execution list is OK but not a per-tenant cost dashboard. |
| Ops tooling | Standard TypeScript, standard git. Full CI/CD. | GUI state-machine; diffs are JSON noise; PR review is painful. |

## But n8n is really good at some things

- Ad-hoc connector hunting — "connect Google Sheets to HubSpot". You would
  NOT build that from scratch in code.
- Non-dev / ops automation. Our client success team can wire Calendly →
  CRM → Slack without bothering engineering.
- Polling + integration clients are cheap to set up.

## Recommendation

**Keep self-hosted n8n running**, but only for:

1. **Ops workflows**: Google Sheet of leads → POST `/api/v1/ingest` to insert
   into a business's CRM. Calendly booked → CRM update. Stripe payment →
   Slack notify.
2. **Nightly digests** — n8n HTTP → our Supabase → generate a CSV → email.
3. **A/B experiments** — when a business wants to try a weird flow for a
   week, let them draft it in n8n against our API, then codify the winning
   flow into a proper feature once it proves out.

**Do NOT put the customer-message hot path through n8n.** It's the part
where:

- A bad guardrail costs a customer's trust.
- A duplicated send costs real money (Meta charges per conversation).
- A 4-second latency kills NPS.

Those all live in compiled code with tests, types, and CI.

## Concrete setup

```
Customer WhatsApp ──► /api/webhooks/ycloud (Next.js on Amplify)
                              │
                              ▼
                     Redis (BullMQ queue)
                              │
                              ▼
                     Worker container (EC2)
                              │
                              ├─► LLM router → reply → YCloud send
                              ├─► Vector retrieval (Qdrant)
                              └─► Supabase persistence


Ops automations (non-hot-path) ──► self-hosted n8n ──► our REST API
                                                       (same Next.js app)
```
