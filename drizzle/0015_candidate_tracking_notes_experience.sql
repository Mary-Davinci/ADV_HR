ALTER TABLE "candidate_profiles" ADD COLUMN "experience_sector" varchar(100);--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD COLUMN "experience_months" integer;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "tracking_notes" text;