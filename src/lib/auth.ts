import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, schema } from "@/lib/db";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "routefit-local-development-secret-change-before-production",
  database: drizzleAdapter(db, { provider: "pg", schema, camelCase: true, transaction: true }),
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