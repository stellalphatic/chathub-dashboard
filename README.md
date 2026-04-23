# ChatHub — omni-channel messaging & automation platform

Multi-tenant app for **Clona** (staff) to provision businesses, and for those
businesses to run **WhatsApp + Instagram + Facebook Messenger** conversations
end-to-end with an AI assistant, a CRM, templates, and broadcasts.

## What's in this repo

```
src/                         Next.js 15 app (web + webhooks)
  app/                         App Router pages
    admin/                     Staff console (Clona)
    app/[orgSlug]/             Business workspace (inbox, bot, knowledge, …)
    api/webhooks/{ycloud,      Channel provider webhooks (signed, idempotent)
                  meta,
                  manychat}/
    api/v1/                    Internal REST for n8n / dashboard uploads
  db/                          Drizzle schema + client
  lib/
    llm/                       Router (Groq → Gemini → OpenAI) + guardrails
    providers/                 YCloud, Meta Graph, ManyChat adapters
    rag/                       Chunker, embedder, Qdrant/Pinecone store
    services/                  Inbound/outbound/LLM reply/RAG ingest
    queue.ts                   BullMQ queues & job types
    redis.ts                   ioredis singleton
    encryption.ts              AES-GCM for stored secrets
    window-24h.ts              WhatsApp 24h customer service window policy
workers/                     BullMQ worker entry + handlers (Node process)
docker-compose.prod.yml      App + worker + Redis + Qdrant for EC2
Dockerfile, Dockerfile.worker
docs/                        ARCHITECTURE, DEPLOY, N8N_VS_CODE, GUARDRAILS
```

## Quick start (local)

```bash
cd chathub
cp .env.example .env.local         # then fill DATABASE_URL + BETTER_AUTH_SECRET
cp .env.production.example .env.production  # for docker compose later

# Generate a strong encryption key
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local

npm install
npm run db:push
npm run dev
```

In another terminal, run the worker (requires Redis locally):

```bash
docker run -d --name chathub-redis -p 6379:6379 redis:7-alpine
echo "REDIS_URL=redis://localhost:6379" >> .env.local
npm run worker
```

For RAG locally, also run Qdrant:

```bash
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant:v1.12.4
echo "QDRANT_URL=http://localhost:6333" >> .env.local
```

Then:

1. Open `/admin/bootstrap` (prod needs `?token=$CHATHUB_SETUP_TOKEN`).
2. Create the first staff user → sign in at `/admin/login`.
3. Paste LLM keys at `/admin/llm` (or set env vars).
4. Create a business at `/admin/organizations/new`.
5. Log in as that business at `/login`.
6. Connect a channel under **Channels**, configure the bot under **Bot**,
   upload docs under **Knowledge**, manage templates under **Templates**.

## Documentation

| File | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the pieces fit — webhooks, queues, worker, LLM router, RAG |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Amplify + EC2 deploy, env vars, smoke test |
| [`docs/GUARDRAILS.md`](docs/GUARDRAILS.md) | Exactly what runs before / after every LLM call |
| [`docs/N8N_VS_CODE.md`](docs/N8N_VS_CODE.md) | Why the hot path is code, not n8n |
| [`docs/SOP_DATABASE_N8N.md`](docs/SOP_DATABASE_N8N.md) | Legacy n8n ingest path (still supported for ops workflows) |
| [`docs/N8N_INGEST.md`](docs/N8N_INGEST.md) | `/api/v1/ingest` reference |

## Production deploy

```bash
# 1) Push Next.js app to Amplify (already wired to this branch).
# 2) On EC2:
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f worker
```

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for full walkthrough.

## Environment

Minimum required variables to boot in production:

```
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
NEXT_PUBLIC_APP_URL
ENCRYPTION_KEY               # AES-256-GCM key (base64, 32B)
REDIS_URL                    # needed for worker + schedule + rate limits
QDRANT_URL                   # if RAG is enabled with Qdrant
GROQ_API_KEY  +  GEMINI_API_KEY  +  OPENAI_API_KEY  (at least one)
```

Full reference → `.env.production.example`.

## Security

- All provider API keys are AES-256-GCM encrypted at rest (`ENCRYPTION_KEY`).
- Each webhook verifies an HMAC signature when the provider signs (YCloud,
  Meta). ManyChat uses a shared secret header.
- Every DB query is tenant-scoped via `organizationId`. Vector stores use
  one collection / namespace per tenant.
- Dev fallback encryption key is used ONLY if `NODE_ENV !== 'production'`
  and `ENCRYPTION_KEY` is missing; production throws.
- Rate limits per-org (LLM calls) and per-channel-connection (sends).
- Guardrails on inbound and outbound text — see `docs/GUARDRAILS.md`.

## Roadmap (Phase 2)

- Voice calls via SIP + Twilio Voice, live transcription during call, agent
  whisper.
- Key rotation script for ENCRYPTION_KEY (batch re-encrypt).
- n8n packaged flows for common ops tasks (Calendly→CRM, Stripe→DM).
- Per-tenant AWS KMS for secrets.
- Analytics Phase 2: funnel dashboards, token cost per tenant.
