CREATE TABLE "api_usage_by_actor_daily" (
  "day" text NOT NULL,
  "actor_key" text NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE CASCADE,
  "route_calculations" integer DEFAULT 0 NOT NULL,
  "external_directions_requests" integer DEFAULT 0 NOT NULL,
  "cache_hits" integer DEFAULT 0 NOT NULL,
  "failed_requests" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_usage_by_actor_daily_pkey" PRIMARY KEY ("day", "actor_key")
);

CREATE INDEX "api_usage_by_actor_daily_user_day_idx" ON "api_usage_by_actor_daily" USING btree ("user_id", "day");
