# Deployment guide

Also read **`docs/THIRD_PARTY_AND_PRODUCTION.md`** for a consolidated checklist (Supabase, Amplify, EC2 workers, auth choices, multi-admin staff, org config lock).

There are two pieces to deploy:

1. **Next.js app** (web + webhooks) — already on AWS Amplify. Just push.
2. **Worker + Redis + Qdrant** — must run on a stateful host (EC2).

## 0. Prereqs

- Supabase project (Postgres). Enable the **Transaction pooler** (port 6543).
- AWS account + Route53 domain (say `chat.yourdomain.com`).
- Channel provider accounts: YCloud (WhatsApp), Meta Business (IG/FB),
  optional ManyChat.

## 1. Database (first-time)

```bash
cd chathub
cp .env.example .env.local
# fill DATABASE_URL + BETTER_AUTH_SECRET

# Push schema. Use the Supabase DIRECT session URL for drizzle-kit (not the
# pooler), otherwise `push` will fail with prepared-statement errors.
DATABASE_URL="postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres" \
  npm run db:push
```

## 2. Bootstrap the first staff user (Clerk)

1. Put your email in `CHATHUB_PLATFORM_ADMIN_EMAILS` on Amplify.
2. Go to `https://chat.yourdomain.com/sign-in` and sign in with that email
   (Clerk sends a 6-digit code).
3. You are now a platform admin. Visit `/admin`.

No bootstrap URL or setup token is needed. Add more staff at `/admin/staff`
once they have signed in at least once.

Open **/admin/llm** and paste Groq + Gemini + OpenAI API keys (or set them as
env vars — the router tries both DB and env).

## 3. AWS Amplify (already done)

Every `git push` to your deploy branch triggers a build. Set these env vars
in the Amplify console:

```
DATABASE_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_APP_URL               = https://chat.yourdomain.com
NEXT_PUBLIC_CLERK_SIGN_IN_URL     = /sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL     = /sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL = /app
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL = /app
CHATHUB_PLATFORM_ADMIN_EMAILS
ENCRYPTION_KEY                    = <openssl rand -base64 32>
REDIS_URL                         = redis://<EC2 private IP>:6379
QDRANT_URL                        = http://<EC2 private IP>:6333
QDRANT_API_KEY                    = ...
GROQ_API_KEY                      = ...      # optional if set via /admin/llm
GEMINI_API_KEY                    = ...
OPENAI_API_KEY                    = ...
META_APP_SECRET
META_VERIFY_TOKEN
YCLOUD_WEBHOOK_SECRET
MANYCHAT_WEBHOOK_SECRET
AWS_REGION                        = us-east-1
AWS_S3_BUCKET                     = chathub-docs-prod
```

Amplify's Lambda runtime can't reach a private EC2 without VPC connectors.
If you choose to run workers somewhere Amplify can't reach Redis, the app
will still ingest messages (writes to DB) but will queue nothing — so put
Redis either on ElastiCache with a public endpoint + auth, OR enable
Amplify → VPC.

## 4. EC2 host for worker + Redis + Qdrant

A single `t3.medium` handles ~200k messages / month comfortably. Upgrade or
scale workers when queue depth grows.

```bash
# On the EC2 instance
sudo yum install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

git clone <your repo> /srv/chathub
cd /srv/chathub/chathub
cp .env.production.example .env.production
# fill in everything (same values as Amplify)

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f worker
```

Scale workers:

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=3
```

Open security-group ports 6379 (Redis) and 6333 (Qdrant) ONLY to the
Amplify VPC / your NAT IP. Never to `0.0.0.0/0`.

## 5. Register channel webhooks

Business user goes to **Dashboard → Channels → Connect a new channel**, picks
the provider, pastes the API key. Then they configure the provider to call:

| Provider | URL |
|---|---|
| YCloud WhatsApp | `https://chat.yourdomain.com/api/webhooks/ycloud` |
| Meta IG/FB | `https://chat.yourdomain.com/api/webhooks/meta` |
| ManyChat | `https://chat.yourdomain.com/api/webhooks/manychat` |

For Meta, set the "Verify Token" to your `META_VERIFY_TOKEN` env. Meta will
hit GET for the handshake, then POST for events.

## 6. First production smoke test

1. Staff: create a new business in `/admin/organizations/new`.
2. Staff: create a client login on the business detail page. Share it.
3. Business user: `/login` → `/app/<slug>/channels` → connect YCloud.
4. Business user: `/app/<slug>/bot` → enable, paste persona, save.
5. Send a WhatsApp message from a real phone → see it in `/app/<slug>/inbox`
   within ~1 second. The bot replies within another 1-3 seconds depending on
   Groq latency.
6. Upload a doc in `/app/<slug>/knowledge` → watch its status flip
   `pending → processing → indexed`. Ask the bot a question answered only by
   the doc → verify it grounds correctly.

## 7. Rotating keys

- **LLM keys** — update in `/admin/llm`, which calls `clearLlmProviderCache()`.
- **ENCRYPTION_KEY** — set the old one as `ENCRYPTION_KEY_PREVIOUS`, the new
  one as `ENCRYPTION_KEY`. Re-deploy. Lazy rotation: every decrypt tries both
  keys and re-writes with the primary. (A batch rotate script is a Phase 2
  nice-to-have.)
- **Channel API keys** — delete the `channel_connection` row in the UI and
  re-add.
