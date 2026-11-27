CREATE TYPE "public"."project_category" AS ENUM('WEBSITE', 'WEB_APP', 'MOBILE_APP', 'AI_AUTOMATION', 'OTHER');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "project_category" NOT NULL,
	"client_id" text,
	"live_url" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"tech" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_on" date,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_category_idx" ON "projects" USING btree ("category");