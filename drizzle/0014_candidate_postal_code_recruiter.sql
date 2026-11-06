ALTER TABLE "candidate_profiles" ADD COLUMN "residence_postal_code" varchar(5);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "recruiter_id" uuid;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_recruiter_id_users_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Fino a questa versione il server (UTC) leggeva come UTC gli orari scritti in ora italiana:
-- si reinterpretano come ora di Roma, cosi' ogni colloquio mantiene l'orario finora mostrato.
UPDATE "interviews" SET "scheduled_at" = ("scheduled_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Rome';
