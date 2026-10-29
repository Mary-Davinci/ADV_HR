CREATE TYPE "public"."candidate_origin" AS ENUM('ADV_CORE', 'INDEED', 'LINKEDIN', 'MANUAL');--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "origin" "candidate_origin" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "orientation_completed_on" date;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "activatable_policies" "active_policy_program"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "candidates_origin_idx" ON "candidates" USING btree ("origin");--> statement-breakpoint
-- Candidati già importati da ADV CORE (collegati in legacy_mappings).
UPDATE "candidates" SET "origin" = 'ADV_CORE' WHERE "id" IN (SELECT "adv_hr_id" FROM "legacy_mappings" WHERE "legacy_system" = 'ADV_CORE' AND "entity_type" = 'CANDIDATE');
