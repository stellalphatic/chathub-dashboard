# ChatHub

Next.js app for **Clona staff** to provision businesses and client logins, and for **clients** to view inbox + analytics. Data is stored in **Postgres** (e.g. Supabase); **n8n** writes `customer` / `message` rows (SQL or HTTP ingest) per [`docs/SOP_DATABASE_N8N.md`](docs/SOP_DATABASE_N8N.md).

## Prerequisites

- Node **20.19+** (or **22.13+** / **24+**). Node 23 may show `EBADENGINE` for eslint; safe to ignore or use Node 22 LTS.
- PostgreSQL (Supabase recommended).

## Install

```bash
cd chathub
npm install
```

See [`.npmrc`](.npmrc) (`legacy-peer-deps`), `@opentelemetry/api`, and `npm audit` notes in the previous sections of git history if needed; same as before.

## Environment

Copy [`.env.example`](.env.example) → `.env.local`:

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
- **`CHATHUB_SETUP_TOKEN`** (production): required for `/admin/bootstrap?token=…` (first staff user only)
- `CHATHUB_PLATFORM_ADMIN_EMAILS` (optional): marks matching emails as platform admin on sign-up (bootstrap is preferred)

## Database

```bash
npm run db:push
```

## End-to-end flow

1. **`npm run dev`** → open `/admin/bootstrap`  
   - **Production:** set `CHATHUB_SETUP_TOKEN`, then open `/admin/bootstrap?token=YOUR_TOKEN`  
   - Creates the **first staff** account (`platform_admin`).
2. Sign in at **`/admin/login`** → create **businesses** → copy **`organization.id`** + ingest secret (for HTTP path).
3. On each business → **Create client login** (email + password) → share credentials securely with the client.
4. Client signs in at **`/login`** (no public registration; `/register` redirects).
5. **n8n:** follow [**SOP_DATABASE_N8N.md**](docs/SOP_DATABASE_N8N.md) so every message uses the correct `organization_id`, upsert rules, and idempotency.

Optional: **`POST /api/v1/ingest`** — see [`docs/N8N_INGEST.md`](docs/N8N_INGEST.md).

## URLs

| URL | Who |
|-----|-----|
| `/demo` | **Static UI preview** (sample data, no DB or login) |
| `/` | Entry: Business vs Staff |
| `/admin/login` | Staff (Clona) |
| `/admin/bootstrap` | First staff user only |
| `/login` | Business users |
| `/app`, `/app/[orgSlug]`, `/app/[orgSlug]/inbox` | Business dashboard |

## Deploy

Set env vars on the host; `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` must match the live origin.

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/admin/(protected)` | Staff console (auth required) |
| `src/app/admin/(public)` | `/admin/login`, `/admin/bootstrap` |
| `src/app/app` | Client shell + dashboard + inbox |
| `src/app/api/v1/ingest` | Optional n8n HTTP writer |
| `src/db/schema.ts` | Tables n8n must respect (see SOP) |
| `docs/SOP_DATABASE_N8N.md` | **Required** n8n / DB standard |
