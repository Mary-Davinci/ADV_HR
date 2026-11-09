CREATE TYPE "public"."residence_permit_status" AS ENUM('NOT_REQUIRED', 'VALID', 'REQUESTED', 'PENDING', 'EXPIRED', 'NONE');--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "nationality" varchar(60);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "residence_permit_status" "residence_permit_status";--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "residence_permit_expires_on" date;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "residence_permit_notes" text;