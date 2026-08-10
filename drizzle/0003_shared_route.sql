CREATE TABLE "shared_route" (
  "id" text PRIMARY KEY NOT NULL,
  "share_id" text NOT NULL,
  "state" text DEFAULT 'active' NOT NULL,
  "snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "purged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shared_route_share_id_idx" ON "shared_route" USING btree ("share_id");
