ALTER TYPE "public"."candidate_origin" ADD VALUE 'WEBSITE';--> statement-breakpoint
CREATE TABLE "career_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"posting_id" uuid,
	"board" varchar(20) NOT NULL,
	"email" varchar(254) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "career_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selection_id" uuid NOT NULL,
	"slug" varchar(240) NOT NULL,
	"board" varchar(20) NOT NULL,
	"content" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_postings_selection_id_unique" UNIQUE("selection_id"),
	CONSTRAINT "career_postings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "career_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"posting_id" uuid,
	"candidate_id" uuid NOT NULL,
	"application_id" uuid,
	"document_id" uuid,
	"possible_duplicate_id" uuid,
	"message" text,
	"privacy_url" text NOT NULL,
	"privacy_version" varchar(40) NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_submissions_challenge_id_unique" UNIQUE("challenge_id")
);
--> statement-breakpoint
ALTER TABLE "career_challenges" ADD CONSTRAINT "career_challenges_posting_id_career_postings_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."career_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_postings" ADD CONSTRAINT "career_postings_selection_id_recruitment_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."recruitment_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_submissions" ADD CONSTRAINT "career_submissions_challenge_id_career_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."career_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_submissions" ADD CONSTRAINT "career_submissions_posting_id_career_postings_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."career_postings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_submissions" ADD CONSTRAINT "career_submissions_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_submissions" ADD CONSTRAINT "career_submissions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_submissions" ADD CONSTRAINT "career_submissions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_submissions" ADD CONSTRAINT "career_submissions_possible_duplicate_id_candidates_id_fk" FOREIGN KEY ("possible_duplicate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_challenges_expiry_idx" ON "career_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "career_postings_public_idx" ON "career_postings" USING btree ("board","published_at");--> statement-breakpoint
CREATE INDEX "career_submissions_candidate_idx" ON "career_submissions" USING btree ("candidate_id");