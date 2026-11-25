CREATE TYPE "public"."document_status" AS ENUM('DRAFT', 'OUT_FOR_SIGNATURE', 'COMPLETED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."document_field_type" AS ENUM('SIGNATURE', 'INITIALS', 'DATE', 'NAME', 'TEXT');--> statement-breakpoint
CREATE TYPE "public"."signer_status" AS ENUM('PENDING', 'SIGNED', 'DECLINED');--> statement-breakpoint
CREATE TABLE "document_events" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"actor_id" text,
	"detail" text NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"signer_id" text NOT NULL,
	"type" "document_field_type" NOT NULL,
	"page" integer NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"w" double precision NOT NULL,
	"h" double precision NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"label" text,
	"value" text,
	"filled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_signers" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"status" "signer_status" DEFAULT 'PENDING' NOT NULL,
	"signed_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"client_id" text,
	"status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_sha256" text NOT NULL,
	"page_count" integer NOT NULL,
	"signed_path" text,
	"signed_sha256" text,
	"created_by_id" text,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_signer_id_document_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."document_signers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signers" ADD CONSTRAINT "document_signers_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signers" ADD CONSTRAINT "document_signers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_events_document_idx" ON "document_events" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_fields_document_idx" ON "document_fields" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_signers_document_idx" ON "document_signers" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_signers_user_idx" ON "document_signers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_created_by_idx" ON "documents" USING btree ("created_by_id");