# ChatHub — production configuration runbook

This is the single source of truth for configuring a ChatHub production deployment. It covers: **architecture**, **which env goes on Amplify vs EC2**, **Supabase**, **Clerk**, **S3 media**, **LLM routing**, **channels**, **templates + broadcasts**, **scheduling**, **caching**, **data-durability guarantees**, and **admin walkthroughs**.

If you've already set up Supabase + Clerk, jump to §2 for the Amplify/EC2 env split and §6 for the admin walkthrough.

---

## 1. Architecture at a glance

```
                         ┌──────────────┐
                 HTTPS   │   Clerk      │  (OTP / magic link / sessions)
          ┌──────────────┤  dashboard   │
          ▼              └──────────────┘
 ┌────────────────┐
 │  AWS Amplify   │  Next.js 15 app, webhooks, /app, /admin, /api/v1/*, /sign-in
 │ dashboard.clona│  - Reads/writes Postgres (pooled)
 │    .site       │  - Enqueues BullMQ jobs on Redis (private)
 └────┬──────┬────┘  - Signs presigned S3 URLs (for uploads)
      │      │
      │      ▼
      │   ┌────────────────┐
      │   │  Supabase      │  Postgres (pgbouncer pooled, 6543)
      │   │  (managed DB)  │
      │   └────────────────┘
      ▼
 ┌────────────────┐
 │   EC2 host     │  docker-compose: worker(s) + redis + qdrant
 │  (private VPC) │  - BullMQ workers process queues
 │                │  - Pull Postgres (same Supabase) — SAME DATA
 │                │  - Mirror media to S3
 │                │  - Call LLMs, YCloud, Meta, ManyChat
 └────┬──────┬────┘
      │      │
      ▼      ▼
 ┌────────┐ ┌────────────────┐
 │  S3    │ │ LLM + Channels │  Groq / Gemini / OpenAI / YCloud / Meta / ManyChat
 └────────┘ └────────────────┘
```

**The important invariants:**

- **Same Postgres** for both Amplify and EC2 → zero data drift. Amplify writes the queued row, EC2 drains it; Amplify reads back the updated status.
- **Same Redis** for both (Amplify enqueues, EC2 dequeues). Redis is on EC2; Amplify reaches it through your VPC connector or a private endpoint.
- **Same S3 bucket** for documents, inbound media mirrors, and any outbound media you add later.
- **Clerk** is only needed by the web process (Amplify). Workers don't touch Clerk.

### 1.1 Message lifecycle (inbound, no-data-loss path)

1. WhatsApp / IG / FB → provider webhook → **Amplify** `/api/webhooks/<provider>`.
2. Webhook handler:
   a. Verifies signature.
   b. Calls `ingestInboundMessage()` which upserts `webhook_event` (unique index → idempotent), `customer`, `conversation`, and inserts `message` in one transaction.
   c. Enqueues `inbound-message` job on Redis.
3. EC2 worker picks up the job:
   a. If `mediaUrl` is set and S3 is configured → enqueues `media-archive` (downloads from provider CDN, uploads to S3, rewrites `message.mediaUrl` to the stable S3 URL).
   b. If voice → enqueues `voice-transcribe`.
   c. If conversation `mode=bot` → enqueues `llm-reply`.
4. `llm-reply` worker:
   a. Reads **cached** bot config + FAQs from Redis (60s TTL).
   b. Runs guardrails / FAQ match / RAG retrieval / LLM call (Groq → Gemini → OpenAI cascade).
   c. Calls `queueOutboundMessage` (inserts outbound `message` row in `queued` status).
   d. Sends via provider; updates row to `sent` / `failed`.

Every write is in Postgres before the queue advances, so a crashed worker simply retries — **no message is lost**. Idempotency comes from `webhook_event`'s unique `(provider, external_id)` index and the `message.provider_message_id` unique index.

### 1.2 Outbound lifecycle (scheduled / broadcast)

1. Admin creates a `broadcast` or `scheduled_message` in DB via UI.
2. For broadcasts → `broadcast-runner` worker expands the audience into `scheduled_message` rows (batched 500 at a time).
3. Every minute the repeatable `scheduled-ticker` worker runs `tickScheduled()` which locks + dispatches due rows into the `outbound-send` queue.
4. `outbound-send` worker rate-limits per channel connection (e.g. 40/s WhatsApp), calls `sendQueuedMessage` → provider API → updates `message.status`.

A worker crash mid-send leaves the row in `sending`. `releaseStaleLocks` returns it to `queued` and the ticker retries on the next minute.

---

## 2. Where each env variable belongs

**Rule of thumb:** Amplify = user-facing/HTTP; EC2 = background workers + their dependencies. Values for `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`, `AWS_*`, `ENCRYPTION_KEY`, and all LLM/channel provider keys **must be identical** on both sides or you'll get split-brain.

### 2.1 Amplify (Next.js web) — required

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **pooler** URL (`…pooler.supabase.com:6543/postgres?pgbouncer=true`) |
| `NEXT_PUBLIC_APP_URL` | `https://dashboard.clona.site` (no trailing slash) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` (production instance) |
| `CLERK_SECRET_KEY` | `sk_live_…` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/app` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/app` |
| `CHATHUB_PLATFORM_ADMIN_EMAILS` | `you@clona.site,partner@clona.site` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` (**same as EC2**) |
| `REDIS_URL` | `redis://<ec2-private-ip>:6379` (from Amplify VPC connector) |
| `QDRANT_URL` | `http://<ec2-private-ip>:6333` |
| `QDRANT_API_KEY` | same as EC2 |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_S3_BUCKET` | `chathub-media-prod` (see §4) |
| `META_APP_SECRET`, `META_VERIFY_TOKEN` | Meta app secrets |
| `YCLOUD_WEBHOOK_SECRET` | YCloud signature secret |
| `MANYCHAT_WEBHOOK_SECRET` | shared secret header |
| LLM keys — optional if you prefer setting via `/admin/llm` UI | `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, plus `*_MODEL`, `*_WHISPER_MODEL`, `*_EMBED_MODEL` |

### 2.2 EC2 (`/srv/chathub/.env.production`) — required

Exactly the same keys as Amplify **except**:

- **Clerk keys are not required** on the worker (workers don't authenticate users).
- `REDIS_URL` stays as the Docker service name → `redis://redis:6379`.
- `QDRANT_URL` stays as the Docker service name → `http://qdrant:6333`.
- `NEXT_PUBLIC_APP_URL` is still useful for templating any callback URLs.

Leaving Clerk keys on EC2 is harmless — they'll just sit unused.

### 2.3 Which keys are **mandatory** for the first production boot

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
- `CHATHUB_PLATFORM_ADMIN_EMAILS` (so you can get into `/admin`)
- `ENCRYPTION_KEY`
- `REDIS_URL`
- One LLM key (`GROQ_API_KEY` is cheapest/fastest for triage)

Everything else can be added incrementally through `/admin/*` UIs or later env updates.

---

## 3. Supabase (Postgres)

You said this is done. Verification:

- In Amplify, `DATABASE_URL` uses the **pooler** host (`…pooler.supabase.com:6543`) and ends with `?pgbouncer=true`.
- On EC2, the `.env.production` also uses the pooler. (Don't use the direct 5432 URL in either runtime — `drizzle-kit push` is the only place that needs direct.)
- Dev schema push is a one-time thing: `DATABASE_URL=<direct 5432> npm run db:push` from a laptop. Don't re-run it in Amplify.

**Backups:** turn on **Point-in-Time Recovery** in Supabase (paid tier). Daily logical backups via `pg_dump` to S3 are an optional belt-and-suspenders layer.

---

## 4. AWS S3 (messages, recordings, images, documents)

### 4.1 Why it matters

Provider CDN URLs (WhatsApp / Meta) **expire**. A message stored with only the provider URL in `message.media_url` is effectively lost after ~30 days. The **`media-archive` worker** we wired up downloads every inbound media file to S3 the moment it arrives and rewrites `message.media_url` to the stable S3 URL.

### 4.2 Create the bucket

1. In AWS Console → **S3 → Create bucket**.
   - Name: `chathub-media-<env>` (e.g. `chathub-media-prod`). Names are global; pick something unique.
   - Region: same as Amplify (e.g. `us-east-1`).
   - **Block all public access**: keep **on**. We'll serve via signed URLs only.
   - Versioning: enable for audit trails (small extra cost).
   - Default encryption: SSE-S3 or SSE-KMS.
2. **Lifecycle** (optional but recommended):
   - Transition objects older than 90 days to `S3 Standard-IA`.
   - Transition objects older than 365 days to `Glacier Instant` / `Glacier Deep` depending on retention policy.

### 4.3 Give the app permission to write/read

You have two options. **Use IAM roles** in production (the AWS SDK picks them up automatically — no keys on disk):

- **Amplify:** Console → App settings → IAM role → create a role with the policy below, then **App settings → Environment variables** leaves `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` **unset**.
- **EC2:** attach an **instance profile** with the same policy.

Minimum policy (`chathub-media-access`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::chathub-media-prod/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::chathub-media-prod"
    }
  ]
}
```

If you must use keys (not recommended), set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Amplify + EC2.

### 4.4 What ends up in S3

- **Inbound media mirror:** `<orgId>/messages/<messageId>/<file>` — created by `media-archive` worker on every inbound image/audio/voice/video/document.
- **Knowledge-base documents:** `<orgId>/documents/<documentId>/<file>` — created by `/api/v1/documents`.
- **Nothing else yet.** Outbound media (sending an image via YCloud) is not wired — add it when you need it.

### 4.5 Verifying media archival

After a test message with an image:

```
SELECT id, media_url, status FROM message WHERE direction='inbound' ORDER BY created_at DESC LIMIT 1;
```

The `media_url` should contain `.s3.<region>.amazonaws.com/`, not a provider CDN host. If it still shows the provider URL:

- Check `AWS_S3_BUCKET` is set on EC2.
- Check the IAM role has `s3:PutObject`.
- Check worker logs: `docker compose logs -f worker | grep media-archive`.

---

## 5. LLM providers + attachments

### 5.1 How the router works

`src/lib/llm/router.ts`:

1. **First preference:** `platform_llm_credential` rows set via `/admin/llm`. Ordered by `priority` (lower = first).
2. **Fallback:** environment variables (`GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`).
3. On HTTP error / timeout from provider N, automatically falls through to N+1.
4. In-process cache for 30 seconds (avoid DB hit every call). `clearLlmProviderCache()` is called whenever admin edits credentials.
5. Every attempt is logged to `llm_usage` with tokens + latency + success — see `/admin/usage`.

### 5.2 Configuration options

| Option | Where | Notes |
|---|---|---|
| Provider keys | `/admin/llm` UI **or** env | UI-stored keys are AES-256-GCM encrypted with `ENCRYPTION_KEY`. |
| Default model per provider | Same UI / env | `GROQ_MODEL`, `GEMINI_MODEL`, `OPENAI_MODEL` |
| Priority | `/admin/llm` UI | Lower = tried first. Typical: Groq=10, Gemini=20, OpenAI=30 |
| Voice transcription | `GROQ_WHISPER_MODEL` / `OPENAI_WHISPER_MODEL` env | Used by `voice-transcribe` worker |
| Embeddings | `GEMINI_EMBED_MODEL` / `OPENAI_EMBED_MODEL` env | Used for RAG doc ingest |
| Per-bot temperature, max tokens | Bot config UI `/app/<slug>/bot` | Stored in `bot_config`, cached (60s) |
| Per-bot system prompt & persona | Bot config UI | Cached + invalidated on save |
| FAQ overrides | Bot FAQ UI `/app/<slug>/bot` | Cached alongside bot config |
| RAG toggle + vector store | Bot config UI | `qdrant` (default) or `pinecone` |

### 5.3 Attachments / multimodal

- **Voice notes:** fully handled — transcribed by Whisper via Groq or OpenAI, then bot replies to the transcript.
- **Images / files (inbound):** stored to S3; currently passed as URL context only (not sent as vision input to the LLM). If you need vision, switch the bot's default model to a vision-capable one (e.g. `gpt-4o-mini`) and extend `replyToConversation` to attach the image URL — small feature, happy to add when needed.
- **Outbound attachments (agent sending an image):** not wired. Use a template with a **header image** as the approved path — Meta approves the header media.

---

## 6. Admin walkthrough — 10-minute end-to-end setup

Once Amplify has Clerk keys and `CHATHUB_PLATFORM_ADMIN_EMAILS`, do this in order:

1. **Sign in as platform admin.** Go to `https://dashboard.clona.site/sign-in`, enter the admin email, complete the Clerk OTP. You land on `/app`. Because your email is in `CHATHUB_PLATFORM_ADMIN_EMAILS`, our JIT sync auto-promotes you to platform staff.
2. **Go to `/admin/llm`.** Add Groq (priority 10), Gemini (priority 20), OpenAI (priority 30). Save.
3. **Go to `/admin/staff`.** Invite any other internal admins — they must sign in once first, then you promote their email.
4. **Create a business.** `/admin/organizations/new` → name + slug. Copy the `organization.id` shown — that's what external integrations reference.
5. **Lock client config (optional).** On the org page, toggle **Client config lock** ON if you don't want the client editing persona / channels themselves.
6. **Invite the client.** Same page → **Invite client login** → enter their email. Clerk sends them an invite link that goes to `/sign-up`.
7. **Client's first sign-in.** They click the email link, enter the OTP, and land on `/app/<slug>`. Our JIT sync attaches them to the org automatically because the invitation carried `publicMetadata.pendingOrgId`.
8. **Client wires a channel.** `/app/<slug>/channels` → Connect → YCloud → paste API key + WhatsApp `from` number. They're ready to receive.
9. **Client points the provider at our webhook:**
    - YCloud: `https://dashboard.clona.site/api/webhooks/ycloud`
    - Meta: `https://dashboard.clona.site/api/webhooks/meta` (verify token = your `META_VERIFY_TOKEN`)
    - ManyChat: `https://dashboard.clona.site/api/webhooks/manychat`
10. **Smoke test.** From a real phone, send a message. Check `/app/<slug>/inbox` — it should appear in ~1–2 s. Send an image; check `message.media_url` in the DB — it should now be an S3 URL, not a provider URL.
11. **Configure the bot persona + FAQs.** `/app/<slug>/bot`. Save. The Redis cache invalidates automatically, so the next message uses the new prompt.
12. **Upload knowledge (optional).** `/app/<slug>/knowledge`. Watch `status: pending → processing → indexed`. Then enable RAG in the bot config.

---

## 7. Templates, broadcasts, and scheduled marketing

### 7.1 Templates

Templates are WhatsApp **approved text templates** (Meta approves via the Business API). ChatHub stores them in the `template` table; we don't upload/approve them for you — YCloud's WABA portal is where you submit.

**Admin flow:**

1. In YCloud (or Meta Business Manager), create a template (e.g. `appointment_reminder` with body `Hi {{1}}, your appointment on {{2}} is confirmed.`).
2. Once Meta marks it **Approved**, go to the ChatHub business dashboard → `/app/<slug>/templates` → **New template**.
3. Enter the **exact** same name (lowercase_underscore), language (e.g. `en`), category, and body (with `{{1}}`, `{{2}}` placeholders).
4. Save with status = draft → edit to **approved** once you're sure YCloud has it too.

### 7.2 Broadcasts (one-shot marketing to an audience)

`/app/<slug>/broadcasts` → **New broadcast**:

- Channel: `whatsapp`
- Channel connection: pick which number to send from
- Template: pick an approved template
- Default variable values: fill `{{1}}`, `{{2}}` with fallback copy
- Audience: tags + statuses + an optional `limit`
- Status starts as `scheduled`. The `broadcast-runner` worker expands audience into `scheduled_message` rows; the `scheduled-ticker` sends them rate-limited (default 40/s, tune via `CHANNEL_SEND_PER_SEC`).

### 7.3 Per-customer scheduled messages

Same flow, but you can create a single `scheduled_message` row at a specific `runAt` timestamp through the existing flow. The ticker handles it.

### 7.4 24-hour window safety

Any freeform (non-template) outbound message is blocked if the customer hasn't messaged in the last 24 h (`src/lib/window-24h.ts`). Template sends are **always** allowed. This keeps Meta happy and you off the suspension list.

---

## 8. Caching (what is cached, for how long, and when it invalidates)

| Data | Where | TTL | Invalidation trigger |
|---|---|---|---|
| LLM provider list + keys | in-process (per Node) | 30 s | `clearLlmProviderCache()` after `/admin/llm` edits |
| Bot config + FAQs | Redis (`bot-cfg:v1:<orgId>`) | 60 s | `invalidateBotConfigCache(orgId)` after persona or FAQ edits |
| Clerk user ↔ local user row | JIT per request | per request | automatic |
| Channel connection secrets | decrypted on each load | per request | no cache (security) |

If you ever see a persona change not take effect:

1. The cache entry already expired after 60 s — retry.
2. If not, the invalidation didn't run (e.g. raw DB edit). Run `FLUSHDB` on Redis or restart workers. The cache will rebuild.

---

## 9. EC2 deployment (if you haven't set it up yet)

1. Launch **t3.medium** in the **same VPC** as Amplify (or set up a VPC peering).
2. Security group:
    - **Inbound** 22 (SSH from your IP only), 6379 (Redis from Amplify NAT only), 6333 (Qdrant from Amplify NAT only). **Never 0.0.0.0/0** for 6379 / 6333.
    - **Outbound** all.
3. SSH in, install Docker:
    ```bash
    sudo yum install -y docker git
    sudo systemctl enable --now docker
    sudo usermod -aG docker ec2-user
    ```
4. Clone + configure:
    ```bash
    git clone <repo> /srv/chathub
    cd /srv/chathub/chathub
    cp .env.production.example .env.production
    # Fill in the same values as Amplify, except REDIS_URL=redis://redis:6379
    # and QDRANT_URL=http://qdrant:6333 (Docker service names).
    ```
5. Attach an IAM instance profile with the S3 policy from §4.3.
6. Start the stack:
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    docker compose -f docker-compose.prod.yml logs -f worker
    ```
7. From Amplify, point `REDIS_URL` / `QDRANT_URL` at the **private IP** of the EC2 instance.
8. Verify queue drain:
    - In Amplify, trigger any action that enqueues (e.g. upload a small text document).
    - On EC2, `docker compose logs -f worker` should show `[worker:embed-document] completed <id>`.

### 9.1 Scaling workers

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=3
```

Each worker opens its own Redis connections; BullMQ auto-load-balances jobs across them.

### 9.2 Monitoring

- **Queue depth:** BullMQ has a built-in dashboard we can add (Bull Board). For now, `docker compose logs` + Redis CLI (`LLEN bull:<queue>:wait`) works.
- **Postgres:** Supabase dashboard → Reports.
- **LLM spend + latency:** `/admin/usage` (queries the `llm_usage` table).

---

## 10. Data durability guarantees (no-loss checklist)

| Guarantee | How it's provided |
|---|---|
| Inbound message never lost | Webhook writes DB row *before* returning 200 → `webhook_event` unique index idempotency |
| Outbound never sent twice | `message.status` state machine (`queued → sending → sent/failed`) + BullMQ `jobId` de-dupe |
| Worker crash during send | `releaseStaleLocks()` flips `sending` back to `queued` on next ticker |
| Media URL expiry | `media-archive` mirrors to S3 on every inbound with media |
| Persona drift between processes | Redis-shared bot config cache; 60 s max staleness |
| LLM provider outage | Router cascades Groq → Gemini → OpenAI |
| DB corruption | Supabase PITR + optional nightly `pg_dump` to S3 |
| Encryption-at-rest leak | `channel_connection.secrets_ciphertext` and `platform_llm_credential.secrets_ciphertext` AES-256-GCM |

---

## 11. Troubleshooting cheatsheet

| Symptom | Check first |
|---|---|
| Sign-in fails with "Clerk key not configured" | Both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` set in Amplify |
| User signs in but not a platform admin | Their email is in `CHATHUB_PLATFORM_ADMIN_EMAILS` **before** they signed in, or promote at `/admin/staff` |
| Invited client lands at `/app` with no orgs | Invitation was created before our JIT fix deployed; use "Link existing login" form |
| Messages arrive in DB but bot never replies | Worker not running, or `conversation.mode != 'bot'`, or all LLM providers are disabled/invalid |
| Media fails to archive | `AWS_S3_BUCKET` unset or IAM role missing `s3:PutObject` |
| Broadcast never fires | Repeatable ticker not registered — restart worker; it calls `ensureRepeatables()` on boot |
| Persona change not visible | Wait 60 s (cache TTL) or redeploy workers |

---

## 12. Security checklist

- [ ] `ENCRYPTION_KEY` set on Amplify **and** EC2 (same value).
- [ ] `ENCRYPTION_KEY_PREVIOUS` kept empty unless actively rotating.
- [ ] Clerk **production** keys on Amplify; development keys never used in prod.
- [ ] Supabase project has PITR enabled.
- [ ] S3 bucket has "Block all public access" = ON.
- [ ] EC2 security group does NOT expose 6379 / 6333 to `0.0.0.0/0`.
- [ ] `.env.production` is gitignored (it already is).
- [ ] `CHATHUB_FORCE_CLIENT_CONFIG_READ_ONLY=true` if you want blanket staff-only persona edits.
- [ ] HTTPS only; Amplify enforces this with ACM.

That's the full runbook. If a step fails, grep the symptom in §11 first; if not listed, the worker logs (`docker compose logs -f worker`) and `/admin/usage` are the two biggest sources of truth.
