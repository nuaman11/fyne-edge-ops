CREATE TABLE "ticket_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"actor_id" text,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "lost_note" text;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_idx" ON "ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_idx" ON "ticket_events" USING btree ("ticket_id");