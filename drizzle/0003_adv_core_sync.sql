CREATE TYPE "public"."adv_core_sync_status" AS ENUM('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."adv_core_sync_trigger" AS ENUM('SCHEDULED', 'MANUAL');--> statement-breakpoint
CREATE TABLE "adv_core_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "legacy_entity_type" NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"payload_hash" varchar(64),
	"payload" jsonb,
	"imported_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conflicts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"file_version" varchar(80),
	"skipped_reason" varchar(120),
	"last_seen_run_id" uuid,
	"last_seen_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_reason" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adv_core_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" "adv_core_sync_trigger" NOT NULL,
	"status" "adv_core_sync_status" DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "adv_core_records" ADD CONSTRAINT "adv_core_records_last_seen_run_id_adv_core_sync_runs_id_fk" FOREIGN KEY ("last_seen_run_id") REFERENCES "public"."adv_core_sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adv_core_records_legacy_uq" ON "adv_core_records" USING btree ("entity_type","legacy_id");--> statement-breakpoint
CREATE INDEX "adv_core_records_removed_idx" ON "adv_core_records" USING btree ("entity_type") WHERE "adv_core_records"."removed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "adv_core_sync_runs_started_at_idx" ON "adv_core_sync_runs" USING btree ("started_at");