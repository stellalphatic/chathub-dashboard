# n8n → ChatHub ingest

`POST /api/v1/ingest` accepts JSON and authenticates with **organization slug** + **ingest secret** (created when an admin adds a business).

**Canonical data rules** (tables, upserts, idempotency) are in [**SOP_DATABASE_N8N.md**](./SOP_DATABASE_N8N.md). If you write the same events **both** via HTTP and direct SQL, avoid double-counting.

## Headers

| Header | Description |
|--------|-------------|
| `X-ChatHub-Org` | Organization **slug** (e.g. `modern-motors`) |
| `X-ChatHub-Secret` | Ingest secret shown once in the admin UI |
| `Content-Type` | `application/json` |

## Body

```json
{
  "phoneE164": "+923189656412",
  "displayName": "Usama",
  "direction": "inbound",
  "body": "Hello",
  "providerMessageId": "optional-stable-id-from-whatsapp",
  "meetingBooked": false,
  "meetingTime": "None Decided",
  "sentiment": "positive",
  "rawPayload": {}
}
```

- **phoneE164** — E.164 phone (ingest normalizes lookups per org).
- **direction** — `inbound` | `outbound`.
- **providerMessageId** — If present, duplicate posts with the same id return `{ duplicate: true }` (idempotency).
- **sentiment** — Optional: `positive` | `negative` | `neutral` (feeds dashboard buckets).
- **meetingBooked** / **meetingTime** — Optional; updates the customer row.

## Example n8n HTTP Request node

- **Method:** POST  
- **URL:** `https://your-chathub-domain.com/api/v1/ingest`  
- **Headers:**  
  - `X-ChatHub-Org`: `{{ $json.orgSlug }}` (or fixed slug)  
  - `X-ChatHub-Secret`: `{{ $credentials.chathub.secret }}` (store in n8n credentials, not in workflow JSON)  
- **Body:** JSON expression built from your webhook payload.

Call once for the customer message and again for the bot reply with `direction: "outbound"` (and a different `providerMessageId` if available).
