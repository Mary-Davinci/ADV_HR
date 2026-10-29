ALTER TYPE "public"."job_request_status" ADD VALUE 'SENT' BEFORE 'READY';--> statement-breakpoint
CREATE TABLE "candidate_document_texts" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"search_vector" "tsvector",
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_requests" ADD COLUMN "recipient_email" varchar(254);--> statement-breakpoint
ALTER TABLE "job_requests" ADD COLUMN "access_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "job_requests" ADD COLUMN "access_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_requests" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_requests" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidate_document_texts" ADD CONSTRAINT "candidate_document_texts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_document_texts" ADD CONSTRAINT "candidate_document_texts_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_document_texts_candidate_idx" ON "candidate_document_texts" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_document_texts_search_idx" ON "candidate_document_texts" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "job_requests_access_token_uq" ON "job_requests" USING btree ("access_token_hash");