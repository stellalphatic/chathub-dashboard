# Migrating from the initial ChatHub schema to v1

The v1 schema is additive: no columns were dropped. But several new tables
and columns were added. Use `npm run db:push` to apply everything at once, or
generate a migration if you prefer:

```bash
npm run db:generate    # writes SQL under drizzle/
npm run db:migrate     # or db:push
```

## New tables

- `channel_connection` — provider credentials (encrypted). Replaces the
  legacy `integration` table for new work; both continue to exist.
- `conversation` — one row per (customer, channel). Every new inbound
  message is linked here; the `message.conversation_id` column is added.
- `handoff` — audit trail of bot↔human mode switches.
- `bot_config`, `bot_faq` — assistant persona + hot-path FAQs.
- `document`, `document_chunk` — RAG knowledge base.
- `template`, `scheduled_message`, `broadcast` — outbound messaging.
- `webhook_event` — idempotency for inbound webhooks.
- `audit_log` — admin & tenant actions.
- `llm_usage` — per-call observability.
- `platform_llm_credential` — AES-GCM encrypted platform LLM keys.

## New columns on existing tables

- `organization`: `plan`, `status`, `monthly_message_cap`, `monthly_token_cap`.
- `organization_member`: default role is now `agent` (was `member`).
- `customer`: `email`, `profile`, `tags`, `status`.
- `message`: `conversation_id`, `channel`, `content_type`, `media_url`,
  `media_mime_type`, `transcript`, `sent_by_user_id`, `sent_by_bot`,
  `template_id`, `status`, `failure_reason`.

## Backfill recommendations (one-off SQL)

After pushing the schema, run these one-off statements to create
conversations for your existing customers + messages:

```sql
-- One conversation per existing customer, channel=whatsapp (legacy default)
insert into conversation (id, organization_id, customer_id, channel, mode, status, created_at, updated_at, last_message_at)
select gen_random_uuid()::text, organization_id, id, 'whatsapp', 'bot', 'open', created_at, updated_at, last_contacted_at
from customer
where not exists (
  select 1 from conversation
  where conversation.customer_id = customer.id
    and conversation.channel = 'whatsapp'
);

-- Stamp conversation_id + channel on old messages
update message m
set conversation_id = c.id,
    channel = 'whatsapp'
from conversation c
where m.conversation_id is null
  and c.customer_id = m.customer_id
  and c.channel = 'whatsapp'
  and c.organization_id = m.organization_id;
```

## No-op for live customers

Inbound ingestion via `/api/v1/ingest` (used by existing n8n flows) keeps
working. It inserts into `customer` + `message` as before; the new
`conversation_id` column on `message` is nullable and will be filled in by
the backfill above.

For **new** webhooks (YCloud / Meta / ManyChat), `src/lib/services/inbound.ts`
creates the conversation row automatically.
