import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

const authSchema = {
  user: schema.user,
  session: schema.session,
  account: schema.account,
  verification: schema.verification,
};

/** Set `BETTER_AUTH_SECRET` in production. Fallback is local/dev only. */
const authSecret =
  process.env.BETTER_AUTH_SECRET ??
  "local-dev-only-replace-with-openssl-rand-base64-32-chars-min";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  plugins: [nextCookies()],
  emailAndPassword: { enabled: true },
  secret: authSecret,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
  ].filter(Boolean) as string[],
  user: {
    additionalFields: {
      platformAdmin: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const raw = process.env.CHATHUB_PLATFORM_ADMIN_EMAILS ?? "";
          const admins = raw
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          const isAdmin = admins.includes(user.email.toLowerCase());
          return {
            data: {
              ...user,
              platformAdmin: isAdmin,
            },
          };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
