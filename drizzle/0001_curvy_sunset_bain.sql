CREATE TABLE "member_workspace" (
	"user_id" text PRIMARY KEY NOT NULL,
	"return_to_start" boolean DEFAULT true NOT NULL,
	"places" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fixed_visit_orders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_workspace" ADD CONSTRAINT "member_workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;