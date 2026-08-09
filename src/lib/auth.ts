import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "routefit-local-development-secret-change-before-production",
  // Railway's public proxy provides the originating client address in X-Real-IP.
  // Use that trusted, single-value header for per-client authentication rate limits.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-real-ip"],
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    // Better Auth resolves these four keys by their singular model names.
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
    camelCase: true,
    transaction: true,
  }),
  socialProviders: googleClientId && googleClientSecret ? {
    google: { clientId: googleClientId, clientSecret: googleClientSecret },
  } : {},
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { createDefaultFavoriteList } = await import("@/lib/member/repository");
          await createDefaultFavoriteList(user.id);
        },
      },
    },
  },
});

export const isGoogleAuthConfigured = Boolean(googleClientId && googleClientSecret && process.env.DATABASE_URL);
