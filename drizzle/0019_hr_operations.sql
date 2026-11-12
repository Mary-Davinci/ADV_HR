CREATE TABLE "candidate_merges" (
	"source_id" uuid PRIMARY KEY NOT NULL,
	"target_id" uuid NOT NULL,
	"merged_by" uuid,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
DROP INDEX "legacy_mappings_adv_hr_uq";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "source_key" varchar(250);--> statement-breakpoint
ALTER TABLE "candidate_merges" ADD CONSTRAINT "candidate_merges_target_id_candidates_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_merges" ADD CONSTRAINT "candidate_merges_merged_by_users_id_fk" FOREIGN KEY ("merged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_merges_target_idx" ON "candidate_merges" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_source_uq" ON "notifications" USING btree ("user_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_mappings_adv_hr_uq" ON "legacy_mappings" USING btree ("legacy_system","entity_type","adv_hr_id") WHERE "legacy_mappings"."entity_type" <> 'CANDIDATE';