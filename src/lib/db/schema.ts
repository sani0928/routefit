import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { FixedVisitOrder, Place } from "@/features/route-optimization/types/route.types";
import type { SharedRouteSnapshot } from "@/features/shared-routes/types";

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId)]);

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routePlans = pgTable("route_plan", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  returnToStart: boolean("return_to_start").notNull().default(true),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routePlanPlaces = pgTable("route_plan_place", {
  id: text("id").primaryKey(),
  routePlanId: text("route_plan_id").notNull().references(() => routePlans.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  stayDurationMinutes: integer("stay_duration_minutes").notNull().default(0),
  isOrderLocked: boolean("is_order_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("route_plan_place_position_idx").on(table.routePlanId, table.position)]);

export const memberWorkspaces = pgTable("member_workspace", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  returnToStart: boolean("return_to_start").notNull().default(true),
  places: jsonb("places").$type<Place[]>().notNull().default([]),
  fixedVisitOrders: jsonb("fixed_visit_orders").$type<FixedVisitOrder[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const placeLists = pgTable("place_list", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedPlaces = pgTable("saved_place", {
  id: text("id").primaryKey(),
  placeListId: text("place_list_id").notNull().references(() => placeLists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  providerId: text("provider_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("saved_place_list_provider_idx").on(table.placeListId, table.providerId)]);

export const sharedRoutes = pgTable("shared_route", {
  id: text("id").primaryKey(),
  shareId: text("share_id").notNull(),
  snapshotFingerprint: text("snapshot_fingerprint").notNull(),
  state: text("state").notNull().default("active"),
  snapshot: jsonb("snapshot").$type<SharedRouteSnapshot | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("shared_route_share_id_idx").on(table.shareId),
  uniqueIndex("shared_route_active_snapshot_fingerprint_idx")
    .on(table.snapshotFingerprint)
    .where(sql`${table.state} = 'active'`),
]);
// Better Auth's Drizzle adapter resolves its core tables by these singular model names.
// The plural exports above remain for the rest of the application.
export const user = users;
export const session = sessions;
export const account = accounts;
export const verification = verifications;
