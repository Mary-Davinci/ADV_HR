CREATE TYPE "public"."job_request_status" AS ENUM('DRAFT', 'READY', 'SIGNED', 'OPENED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "job_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" "job_request_status" DEFAULT 'DRAFT' NOT NULL,
	"form" jsonb NOT NULL,
	"validated_form" jsonb,
	"signed_document_id" uuid,
	"selection_id" uuid,
	"review_note" text,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_signed_document_id_documents_id_fk" FOREIGN KEY ("signed_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_selection_id_recruitment_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."recruitment_selections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_requests_code_uq" ON "job_requests" USING btree ("code");--> statement-breakpoint
CREATE INDEX "job_requests_company_idx" ON "job_requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "job_requests_status_idx" ON "job_requests" USING btree ("status");