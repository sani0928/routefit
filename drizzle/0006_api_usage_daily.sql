CREATE TABLE "api_usage_daily" (
  "day" text PRIMARY KEY NOT NULL,
  "route_calculations" integer DEFAULT 0 NOT NULL,
  "external_directions_requests" integer DEFAULT 0 NOT NULL,
  "cache_hits" integer DEFAULT 0 NOT NULL,
  "failed_requests" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
