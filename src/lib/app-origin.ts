/** Canonical public origin for server-side calls (auth redirects, ingest, webhooks). */
export function getAppOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.CLERK_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
