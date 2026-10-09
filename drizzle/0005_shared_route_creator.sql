ALTER TABLE "shared_route" ADD COLUMN "created_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "shared_route" ADD CONSTRAINT "shared_route_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "shared_route_active_snapshot_fingerprint_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "shared_route_active_user_snapshot_fingerprint_idx" ON "shared_route" USING btree ("created_by_user_id", "snapshot_fingerprint") WHERE "state" = 'active' AND "created_by_user_id" IS NOT NULL;
