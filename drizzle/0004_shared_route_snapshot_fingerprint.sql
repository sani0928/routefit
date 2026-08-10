ALTER TABLE "shared_route" ADD COLUMN "snapshot_fingerprint" text;
--> statement-breakpoint
UPDATE "shared_route" SET "snapshot_fingerprint" = 'legacy-' || "id" WHERE "snapshot_fingerprint" IS NULL;
--> statement-breakpoint
ALTER TABLE "shared_route" ALTER COLUMN "snapshot_fingerprint" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "shared_route_active_snapshot_fingerprint_idx" ON "shared_route" USING btree ("snapshot_fingerprint") WHERE "state" = 'active';
