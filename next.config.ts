import type { NextConfig } from "next";

/**
 * Explicit server-side env var passthrough.
 *
 * On AWS Amplify Hosting, env vars set in the console are available to the
 * *build* environment but not always to the Next.js middleware Lambda at
 * runtime (symptom: "Missing secretKey" despite having the var set).
 *
 * Declaring them here forces Next.js to inline the value at build time.
 * The resulting `.next/server` bundle reads the baked value via
 * `process.env.X`, so the middleware Lambda no longer depends on the
 * Amplify runtime passing the variable through.
 *
 * Only list *server* variables here. `NEXT_PUBLIC_*` vars are handled by
 * Next.js's built-in public env mechanism and do not need to be listed.
 */
const serverEnv = {
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "",
  ENCRYPTION_KEY_PREVIOUS: process.env.ENCRYPTION_KEY_PREVIOUS ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  QDRANT_URL: process.env.QDRANT_URL ?? "",
  QDRANT_API_KEY: process.env.QDRANT_API_KEY ?? "",
  S3_REGION: process.env.S3_REGION ?? "",
  S3_BUCKET: process.env.S3_BUCKET ?? "",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "",
  META_APP_SECRET: process.env.META_APP_SECRET ?? "",
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN ?? "",
  YCLOUD_WEBHOOK_SECRET: process.env.YCLOUD_WEBHOOK_SECRET ?? "",
  MANYCHAT_WEBHOOK_SECRET: process.env.MANYCHAT_WEBHOOK_SECRET ?? "",
  CHATHUB_PLATFORM_ADMIN_EMAILS: process.env.CHATHUB_PLATFORM_ADMIN_EMAILS ?? "",
  CHATHUB_FORCE_CLIENT_CONFIG_READ_ONLY:
    process.env.CHATHUB_FORCE_CLIENT_CONFIG_READ_ONLY ?? "",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
};

// Remove empty keys so Next.js doesn't inline empty strings
const envPassthrough: Record<string, string> = {};
for (const [k, v] of Object.entries(serverEnv)) {
  if (v) envPassthrough[k] = v;
}

const nextConfig: NextConfig = {
  // Required for Docker image (AWS EC2 / Fargate). Amplify/Netlify ignore it.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  env: envPassthrough,
  serverExternalPackages: [
    "postgres",
    "bullmq",
    "ioredis",
    "pdf-parse",
    "mammoth",
    "@qdrant/js-client-rest",
  ],
  experimental: {
    // Allow worker scripts outside /src
    externalDir: true,
    serverActions: {
      // Lock allowed origins so Server Actions can never be invoked
      // cross-site. The Amplify primary domain + the chathub subdomain.
      allowedOrigins: [
        "dashboard.clona.site",
        "*.amplifyapp.com",
        "localhost:3000",
      ],
      bodySizeLimit: "5mb",
    },
  },
  // Server-rendered admin/app pages must not be cached by CloudFront.
  // Without this, a new deploy can leave clients holding HTML that
  // references Server Action IDs that don't exist on the new server bundle
  // ("Server Action … was not found"). We make every dashboard route fetch
  // fresh HTML on every navigation.
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/sign-in",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/sign-up",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
