-- pgvector: richiesto dalle tabelle *_embeddings. Richiede privilegi adeguati
-- (in produzione l'estensione va abilitata dal DBA). Idempotente.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."active_policy_program" AS ENUM('GOL', 'GARANZIA_GIOVANI', 'DOTE_UNICA_LAVORO', 'TIROCINIO', 'ASSEGNO_RICOLLOCAZIONE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."active_policy_status" AS ENUM('ACTIVE', 'COMPLETED', 'INTERRUPTED');--> statement-breakpoint
CREATE TYPE "public"."activity_action" AS ENUM('CREATED', 'UPDATED', 'STATUS_CHANGED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_UPDATED', 'INTERVIEW_COMPLETED', 'INTERVIEW_CANCELLED', 'FEEDBACK_ADDED', 'EVALUATION_ADDED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'TASK_CREATED', 'TASK_COMPLETED', 'ADDED_TO_POOL', 'REMOVED_FROM_POOL', 'APPLICATION_CREATED', 'PHONE_CALL', 'EMAIL', 'WHATSAPP', 'INTERVIEW', 'FOLLOW_UP', 'OTHER_CONTACT');--> statement-breakpoint
CREATE TYPE "public"."activity_entity_type" AS ENUM('CANDIDATE', 'APPLICATION', 'INTERVIEW', 'COMPANY', 'SELECTION', 'DOCUMENT', 'TASK', 'TALENT_POOL');--> statement-breakpoint
CREATE TYPE "public"."application_source" AS ENUM('MANUAL', 'ADV_HR', 'ADV_CORE', 'INDEED', 'LINKEDIN', 'WEBSITE', 'EMAIL', 'REFERRAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'STAGE_CHANGE', 'EVALUATE', 'UPLOAD', 'LOGIN');--> statement-breakpoint
CREATE TYPE "public"."availability_type" AS ENUM('IMMEDIATE', 'WITHIN_2_WEEKS', 'WITHIN_1_MONTH', 'OVER_1_MONTH', 'NOT_AVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."company_source" AS ENUM('ADV_HR', 'ADV_CORE');--> statement-breakpoint
CREATE TYPE "public"."document_processing_status" AS ENUM('UPLOADED', 'PENDING', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('CV', 'COVER_LETTER', 'CERTIFICATION', 'IDENTITY_DOCUMENT', 'JOB_DESCRIPTION', 'CONTRACT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."driving_license_category" AS ENUM('AM', 'A1', 'A2', 'A', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'CQC_GOODS', 'CQC_PASSENGERS', 'FORKLIFT');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('LOWER_SECONDARY', 'VOCATIONAL', 'UPPER_SECONDARY', 'POST_SECONDARY', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('EMPLOYED', 'UNEMPLOYED', 'INACTIVE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."evaluation_result" AS ENUM('SUITABLE', 'NOT_SUITABLE', 'TO_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('GENERAL', 'INTERVIEW', 'PHONE_SCREENING', 'CLIENT', 'INTERNAL_NOTE');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('FEMALE', 'MALE', 'NON_BINARY', 'NOT_SPECIFIED');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."interview_type" AS ENUM('SCREENING', 'HR', 'TECHNICAL', 'CLIENT', 'FOLLOW_UP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."language_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE');--> statement-breakpoint
CREATE TYPE "public"."legacy_entity_type" AS ENUM('CANDIDATE', 'COMPANY', 'USER', 'DOCUMENT', 'APPLICATION');--> statement-breakpoint
CREATE TYPE "public"."legacy_system" AS ENUM('ADV_CORE');--> statement-breakpoint
CREATE TYPE "public"."matching_evidence_status" AS ENUM('PASS', 'FAIL', 'UNKNOWN', 'REVIEW_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."matching_overall_status" AS ENUM('SUGGESTED', 'COHERENT', 'PARTIAL', 'TO_VERIFY', 'NOT_COMPATIBLE');--> statement-breakpoint
CREATE TYPE "public"."matching_requirement_code" AS ENUM('LOCATION', 'RELOCATION', 'WORK_MODE', 'WORK_TIME', 'DRIVING_LICENSE', 'PROTECTED_CATEGORY', 'EDUCATION', 'LANGUAGE', 'CERTIFICATION', 'EXPERIENCE', 'SKILL', 'SEMANTIC_SIMILARITY');--> statement-breakpoint
CREATE TYPE "public"."protected_category" AS ENUM('NONE', 'ART_1', 'ART_18', 'NOT_SPECIFIED');--> statement-breakpoint
CREATE TYPE "public"."selection_status" AS ENUM('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('TECHNICAL', 'DIGITAL', 'SOFT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('LOCAL', 'MEMORY');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('ONSITE', 'REMOTE', 'HYBRID', 'FLEXIBLE');--> statement-breakpoint
CREATE TYPE "public"."work_time" AS ENUM('FULL_TIME', 'PART_TIME', 'EITHER');--> statement-breakpoint
CREATE TABLE "recruiter_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"department" varchar(120),
	"phone" varchar(40),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"password_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_policy_participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"program_type" "active_policy_program" NOT NULL,
	"reference_year" integer NOT NULL,
	"status" "active_policy_status",
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"issuer" varchar(160),
	"issued_at" date,
	"expires_at" date,
	"credential_id" varchar(120),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_driving_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"category" "driving_license_category" NOT NULL,
	"valid" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"qualification" varchar(200) NOT NULL,
	"field_of_study" varchar(160),
	"institution" varchar(200),
	"year" smallint,
	"level" "education_level" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"company_name" varchar(160) NOT NULL,
	"role_title" varchar(160) NOT NULL,
	"sector" varchar(100),
	"start_date" date NOT NULL,
	"end_date" date,
	"description" text,
	"current_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_experiences_dates_ck" CHECK ("candidate_experiences"."end_date" IS NULL OR "candidate_experiences"."end_date" >= "candidate_experiences"."start_date")
);
--> statement-breakpoint
CREATE TABLE "candidate_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"sector" varchar(100) NOT NULL,
	"priority" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"language" varchar(60) NOT NULL,
	"level" "language_level" NOT NULL,
	"certified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_preferences" (
	"candidate_id" uuid PRIMARY KEY NOT NULL,
	"availability" "availability_type",
	"desired_employment_type" "work_time",
	"desired_work_time" "work_time",
	"desired_work_mode" "work_mode",
	"willing_to_relocate" boolean,
	"willing_to_travel" boolean,
	"preferred_locations" text[],
	"availability_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profiles" (
	"candidate_id" uuid PRIMARY KEY NOT NULL,
	"residence_address" varchar(200),
	"residence_city" varchar(100),
	"residence_province" varchar(2),
	"residence_region" varchar(60),
	"residence_country" varchar(2) DEFAULT 'IT',
	"protected_category" "protected_category" DEFAULT 'NOT_SPECIFIED' NOT NULL,
	"protected_category_notes" text,
	"employment_status" "employment_status" DEFAULT 'UNKNOWN' NOT NULL,
	"professional_summary" text,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_skills" (
	"candidate_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" smallint,
	"years_experience" smallint,
	"verified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_skills_candidate_id_skill_id_pk" PRIMARY KEY("candidate_id","skill_id"),
	CONSTRAINT "candidate_skills_level_ck" CHECK ("candidate_skills"."level" IS NULL OR "candidate_skills"."level" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "candidate_tags" (
	"candidate_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_tags_candidate_id_tag_id_pk" PRIMARY KEY("candidate_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"fiscal_code" varchar(16),
	"email" varchar(254),
	"phone" varchar(40),
	"birth_date" date,
	"gender" "gender" DEFAULT 'NOT_SPECIFIED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" "skill_category" DEFAULT 'OTHER' NOT NULL,
	"normalized_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(60) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "application_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"result" "evaluation_result" NOT NULL,
	"reason" text,
	"notes" text,
	"evaluated_by" uuid NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_evaluations_reason_ck" CHECK ("application_evaluations"."result" <> 'NOT_SUITABLE' OR ("application_evaluations"."reason" IS NOT NULL AND length(trim("application_evaluations"."reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"selection_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"recruiter_id" uuid,
	"source" "application_source" DEFAULT 'MANUAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"vat_number" varchar(20),
	"fiscal_code" varchar(16),
	"sector" varchar(100),
	"city" varchar(100),
	"province" varchar(2),
	"region" varchar(60),
	"email" varchar(254),
	"phone" varchar(40),
	"notes" text,
	"source" "company_source" DEFAULT 'ADV_HR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"interview_id" uuid,
	"author_id" uuid NOT NULL,
	"type" "feedback_type" DEFAULT 'GENERAL' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"recruiter_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"type" "interview_type" DEFAULT 'HR' NOT NULL,
	"status" "interview_status" DEFAULT 'SCHEDULED' NOT NULL,
	"location" varchar(200),
	"meeting_url" varchar(500),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_duration_ck" CHECK ("interviews"."duration_minutes" IS NULL OR "interviews"."duration_minutes" BETWEEN 5 AND 600)
);
--> statement-breakpoint
CREATE TABLE "job_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selection_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text,
	"duties" text,
	"requirements" text,
	"employment_type" "work_time",
	"work_time" "work_time",
	"work_mode" "work_mode",
	"salary_min" numeric(10, 2),
	"salary_max" numeric(10, 2),
	"currency" char(3),
	"working_hours" varchar(200),
	"location_city" varchar(100),
	"location_province" varchar(2),
	"location_region" varchar(60),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_descriptions_selection_id_unique" UNIQUE("selection_id"),
	CONSTRAINT "job_descriptions_salary_ck" CHECK ("job_descriptions"."salary_min" IS NULL OR "job_descriptions"."salary_max" IS NULL OR "job_descriptions"."salary_max" >= "job_descriptions"."salary_min")
);
--> statement-breakpoint
CREATE TABLE "recruiting_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	"position" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "recruiting_stages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "recruitment_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" "selection_status" DEFAULT 'DRAFT' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "activity_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "activity_action" NOT NULL,
	"actor_id" uuid,
	"candidate_id" uuid,
	"selection_id" uuid,
	"company_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"application_id" uuid,
	"company_id" uuid,
	"selection_id" uuid,
	"type" "document_type" NOT NULL,
	"filename" varchar(255) NOT NULL,
	"storage_provider" "storage_provider" NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" bigint,
	"processing_status" "document_processing_status" DEFAULT 'UPLOADED' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "legacy_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "legacy_entity_type" NOT NULL,
	"adv_hr_id" uuid NOT NULL,
	"legacy_system" "legacy_system" NOT NULL,
	"legacy_id" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_pool_candidates" (
	"talent_pool_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "talent_pool_candidates_talent_pool_id_candidate_id_pk" PRIMARY KEY("talent_pool_id","candidate_id")
);
--> statement-breakpoint
CREATE TABLE "talent_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "talent_pools_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"assigned_to" uuid NOT NULL,
	"created_by" uuid,
	"candidate_id" uuid,
	"application_id" uuid,
	"selection_id" uuid,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"priority" "task_priority" DEFAULT 'MEDIUM' NOT NULL,
	"status" "task_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"embedding_model" varchar(120) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_description_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_description_id" uuid NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"embedding_model" varchar(120) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"requirement_code" "matching_requirement_code" NOT NULL,
	"status" "matching_evidence_status" NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"overall_status" "matching_overall_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selection_id" uuid NOT NULL,
	"created_by" uuid,
	"engine_version" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_policy_participations" ADD CONSTRAINT "active_policy_participations_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_certifications" ADD CONSTRAINT "candidate_certifications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_driving_licenses" ADD CONSTRAINT "candidate_driving_licenses_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_education" ADD CONSTRAINT "candidate_education_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_experiences" ADD CONSTRAINT "candidate_experiences_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_interests" ADD CONSTRAINT "candidate_interests_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_languages" ADD CONSTRAINT "candidate_languages_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_preferences" ADD CONSTRAINT "candidate_preferences_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_evaluated_by_users_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_selection_id_recruitment_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."recruitment_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_stage_id_recruiting_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."recruiting_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_recruiter_id_users_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_recruiter_id_users_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_selection_id_recruitment_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."recruitment_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_selections" ADD CONSTRAINT "recruitment_selections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_selections" ADD CONSTRAINT "recruitment_selections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_selection_id_recruitment_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."recruitment_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_talent_pool_id_talent_pools_id_fk" FOREIGN KEY ("talent_pool_id") REFERENCES "public"."talent_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pool_candidates" ADD CONSTRAINT "talent_pool_candidates_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_pools" ADD CONSTRAINT "talent_pools_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_selection_id_recruitment_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."recruitment_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_embeddings" ADD CONSTRAINT "candidate_embeddings_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_embeddings" ADD CONSTRAINT "job_description_embeddings_job_description_id_job_descriptions_id_fk" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_evidence" ADD CONSTRAINT "matching_evidence_result_id_matching_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."matching_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_results" ADD CONSTRAINT "matching_results_run_id_matching_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."matching_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_results" ADD CONSTRAINT "matching_results_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_selection_id_recruitment_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."recruitment_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "active_policy_participations_candidate_idx" ON "active_policy_participations" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_certifications_candidate_idx" ON "candidate_certifications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_driving_licenses_candidate_idx" ON "candidate_driving_licenses" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_driving_licenses_uq" ON "candidate_driving_licenses" USING btree ("candidate_id","category");--> statement-breakpoint
CREATE INDEX "candidate_education_candidate_idx" ON "candidate_education" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_experiences_candidate_idx" ON "candidate_experiences" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_interests_candidate_idx" ON "candidate_interests" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_languages_candidate_idx" ON "candidate_languages" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_languages_language_idx" ON "candidate_languages" USING btree (lower("language"));--> statement-breakpoint
CREATE INDEX "candidate_profiles_city_idx" ON "candidate_profiles" USING btree (lower("residence_city"));--> statement-breakpoint
CREATE INDEX "candidate_profiles_region_idx" ON "candidate_profiles" USING btree ("residence_region");--> statement-breakpoint
CREATE INDEX "candidate_skills_skill_idx" ON "candidate_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "candidate_tags_tag_idx" ON "candidate_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "candidates_last_name_idx" ON "candidates" USING btree (lower("last_name"));--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_fiscal_code_uq" ON "candidates" USING btree ("fiscal_code");--> statement-breakpoint
CREATE INDEX "candidates_email_idx" ON "candidates" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "candidates_updated_at_idx" ON "candidates" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "application_evaluations_application_idx" ON "application_evaluations" USING btree ("application_id","evaluated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_candidate_selection_uq" ON "applications" USING btree ("candidate_id","selection_id");--> statement-breakpoint
CREATE INDEX "applications_candidate_idx" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "applications_selection_idx" ON "applications" USING btree ("selection_id");--> statement-breakpoint
CREATE INDEX "applications_stage_idx" ON "applications" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "applications_recruiter_idx" ON "applications" USING btree ("recruiter_id");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "companies_vat_number_uq" ON "companies" USING btree ("vat_number");--> statement-breakpoint
CREATE INDEX "feedbacks_application_idx" ON "feedbacks" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "interviews_scheduled_at_idx" ON "interviews" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "interviews_recruiter_idx" ON "interviews" USING btree ("recruiter_id");--> statement-breakpoint
CREATE INDEX "interviews_application_idx" ON "interviews" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "recruitment_selections_company_idx" ON "recruitment_selections" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "recruitment_selections_status_idx" ON "recruitment_selections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activities_entity_idx" ON "activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activities_candidate_idx" ON "activities" USING btree ("candidate_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_selection_idx" ON "activities" USING btree ("selection_id","created_at");--> statement-breakpoint
CREATE INDEX "activities_company_idx" ON "activities" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "documents_candidate_idx" ON "documents" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "documents_company_idx" ON "documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "documents_selection_idx" ON "documents" USING btree ("selection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_mappings_legacy_uq" ON "legacy_mappings" USING btree ("legacy_system","entity_type","legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_mappings_adv_hr_uq" ON "legacy_mappings" USING btree ("legacy_system","entity_type","adv_hr_id");--> statement-breakpoint
CREATE INDEX "talent_pool_candidates_candidate_idx" ON "talent_pool_candidates" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_status_idx" ON "tasks" USING btree ("assigned_to","status");--> statement-breakpoint
CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "tasks_candidate_idx" ON "tasks" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_embeddings_candidate_model_uq" ON "candidate_embeddings" USING btree ("candidate_id","embedding_model");--> statement-breakpoint
CREATE INDEX "candidate_embeddings_hnsw_idx" ON "candidate_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "job_description_embeddings_jd_model_uq" ON "job_description_embeddings" USING btree ("job_description_id","embedding_model");--> statement-breakpoint
CREATE INDEX "job_description_embeddings_hnsw_idx" ON "job_description_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "matching_evidence_result_idx" ON "matching_evidence" USING btree ("result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matching_results_run_candidate_uq" ON "matching_results" USING btree ("run_id","candidate_id");--> statement-breakpoint
CREATE INDEX "matching_runs_selection_idx" ON "matching_runs" USING btree ("selection_id","created_at");