# SOP: Storing WhatsApp / bot data for ChatHub (n8n → Postgres)

This document is the **single standard** for how automation writes data so the **ChatHub dashboard** (inbox, analytics, leads) stays correct. Deviations break queries or duplicate rows.

---

## 1. Mental model

| Piece | Role |
|-------|------|
| **Supabase Postgres** | One database. ChatHub reads `organization`, `customer`, `message`, etc. |
| **n8n** | Runs automations (WhatsApp webhook, AI, CRM). Writes rows **either** via **Postgres/Supabase node** (SQL) **or** via **HTTP Request** to ChatHub `/api/v1/ingest`. |
| **Tenant** | One row in `organization`. Every business row **must** include that org’s `organization_id` (UUID). |

You may use **both** HTTP ingest and direct SQL **only if** they write the **same logical rows** (avoid double-inserting the same message).

---

## 2. Identify the tenant in n8n

For each client chatbot:

1. In ChatHub **Staff** → open the business → copy **`organization.id`** (UUID) and **`slug`**.
2. Store them in n8n **Credentials** or an n8n **Data table** (not hard-coded secrets in exported JSON).
3. Every insert/update for that client must use the same **`organization_id`**.

**Distinguish clients** by:

- **Separate workflows** per client (simplest), or  
- **One workflow** + **Switch** on `wabaId` / business WhatsApp number / static config key → resolve `organization_id`.

---

## 3. Canonical tables (dashboard dependencies)

Names are **PostgreSQL** / Drizzle (`snake_case` columns).

### `organization`

- Created in ChatHub admin UI.  
- Do **not** insert manually unless you know what you’re doing.

### `customer` (one row per WhatsApp contact per org)

| Column | Required | Notes |
|--------|----------|--------|
| `id` | Yes | UUID text, unique globally. Generate in n8n (`{{ $uuid }}` or crypto). |
| `organization_id` | Yes | From staff console. |
| `phone_e164` | Yes | E.164, e.g. `+923189656412`. Stable per person. |
| `display_name` | No | From WhatsApp profile when available. |
| `last_contacted_at` | No | Timestamp; update on each message for “recency” in UI. |
| `meeting_booked` | No | Boolean; default `false`. |
| `meeting_time` | No | Text, e.g. slot string from your bot JSON. |
| `metadata` | No | JSON object for extra flags (lead stage, tags). |
| `created_at`, `updated_at` | Yes | `now()` |

**Unique rule:** `(organization_id, phone_e164)` must be unique.  
**SOP:** Upsert customer **before** inserting a message: if row exists, update `display_name` / `last_contacted_at` / `meeting_*` / `metadata`; if not, insert.

### `message` (one row per WhatsApp line / bot reply)

| Column | Required | Notes |
|--------|----------|--------|
| `id` | Yes | UUID text. |
| `organization_id` | Yes | Same as customer’s org. |
| `customer_id` | Yes | FK to `customer.id`. |
| `direction` | Yes | Exactly `inbound` or `outbound`. |
| `body` | Yes | Plain text of the message. |
| `provider_message_id` | Strongly recommended | WhatsApp / provider message id. **Idempotency:** same org + same id must not insert twice (unique index). If unknown, leave `NULL` (duplicates possible—avoid if you can). |
| `sentiment` | No | Only: `positive`, `negative`, `neutral` (dashboard buckets). |
| `raw_payload` | No | JSON: webhook body, model output, **timestamps for latency** (see §6). |
| `created_at` | Yes | Server time or provider time in UTC. |

---

## 4. Order of operations (every inbound turn)

Run in this order inside n8n:

1. **Normalize phone** to E.164 (strip spaces; keep country code and `+` if you use it consistently—match what you already store).
2. **Upsert `customer`** for `(organization_id, phone_e164)`.
3. **Insert `message`** inbound row with `provider_message_id` from the webhook.
4. Run **AI / tools** (Sheets, RAG, etc.).
5. **Insert `message`** outbound row(s) with a **new** `id` and **different** `provider_message_id` if the provider gives one.
6. **Update `customer`** with `last_contacted_at = now()`, and optional `meeting_booked`, `meeting_time`, `metadata` from structured AI output.

On errors, log the execution in n8n; do not partially insert two outbounds for the same logical reply without distinct ids.

---

## 5. Optional: HTTP ingest instead of SQL

If you prefer not to run SQL in n8n, `POST /api/v1/ingest` with headers `X-ChatHub-Org` (slug) and `X-ChatHub-Secret` performs upsert + message insert with the same rules. See [N8N_INGEST.md](./N8N_INGEST.md).

---

## 6. Latency, logs, and “extra” analytics

The dashboard does not yet have dedicated columns for every metric. Until you add migrations:

- Put **webhook `createTime`**, **n8n execution id**, **model latency ms**, **YCloud message ids** inside **`message.raw_payload`** as JSON.
- Use **consistent keys** across flows, e.g.  
  `{"source":"ycloud","webhook_create_time":"...","n8n_execution_id":"...","llm_ms":123}`

Later, ChatHub can aggregate from `raw_payload` or you add proper columns following a new SOP revision.

---

## 7. Leads and follow-ups

Until a dedicated `lead` table exists:

- Use **`customer.metadata`** JSON with agreed keys, e.g.  
  `{"lead_status":"new|contacted|qualified|lost","next_follow_up":"2026-04-10","owner":"sales-1"}`  
- Or add rows to your own **`integration`**-linked CRM; the dashboard inbox still needs **`customer` + `message`** in this database for threads.

Document your **metadata** schema in a one-page appendix per client if keys differ.

---

## 8. Security checklist

- DB credentials: **n8n Credentials**, rotate if leaked.  
- Ingest secret: same.  
- Use **SSL** connection string to Supabase.  
- **RLS:** ChatHub app uses its DB user; n8n can use a **separate DB role** with `INSERT/UPDATE` only on `customer`, `message` (and optionally `integration`) for that schema—avoid superuser.  
- Never expose service role key in the browser.

---

## 9. Quick SQL shapes (reference)

**Upsert customer** (PostgreSQL `ON CONFLICT` on `(organization_id, phone_e164)` — adjust to your conflict target):

```sql
INSERT INTO customer (id, organization_id, phone_e164, display_name, last_contacted_at, meeting_booked, meeting_time, metadata, created_at, updated_at)
VALUES ($1, $2, $3, $4, NOW(), false, NULL, '{}', NOW(), NOW())
ON CONFLICT (organization_id, phone_e164)
DO UPDATE SET
  display_name = COALESCE(EXCLUDED.display_name, customer.display_name),
  last_contacted_at = EXCLUDED.last_contacted_at,
  updated_at = NOW();
```

**Insert message** (check duplicate `provider_message_id` first or rely on unique constraint and handle error):

```sql
INSERT INTO message (id, organization_id, customer_id, direction, body, provider_message_id, sentiment, raw_payload, created_at)
VALUES ($1, $2, $3, 'inbound', $4, $5, NULL, $6::jsonb, NOW());
```

---

## 10. Versioning

When the schema changes, update this file’s date and section 3, and announce to anyone maintaining n8n flows.
