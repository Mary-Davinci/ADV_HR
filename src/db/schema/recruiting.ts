import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./_shared";
import { candidates } from "./candidates";
import {
  applicationSourceEnum,
  companySourceEnum,
  evaluationResultEnum,
  feedbackTypeEnum,
  interviewStatusEnum,
  interviewTypeEnum,
  selectionStatusEnum,
  workModeEnum,
  workTimeEnum,
} from "./enums";
import { users } from "./identity";

export const companies = pgTable(
  "companies",
  {
    id: id(),
    name: varchar("name", { length: 200 }).notNull(),
    vatNumber: varchar("vat_number", { length: 20 }),
    fiscalCode: varchar("fiscal_code", { length: 16 }),
    sector: varchar("sector", { length: 100 }),
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 2 }),
    region: varchar("region", { length: 60 }),
    email: varchar("email", { length: 254 }),
    phone: varchar("phone", { length: 40 }),
    notes: text("notes"),
    source: companySourceEnum("source").notNull().default("ADV_HR"),
    ...timestamps(),
  },
  (t) => [
    index("companies_name_idx").on(sql`lower(${t.name})`),
    uniqueIndex("companies_vat_number_uq").on(t.vatNumber),
  ],
);

export const recruitmentSelections = pgTable(
  "recruitment_selections",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    status: selectionStatusEnum("status").notNull().default("DRAFT"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    index("recruitment_selections_company_idx").on(t.companyId),
    index("recruitment_selections_status_idx").on(t.status),
  ],
);

export const jobDescriptions = pgTable(
  "job_descriptions",
  {
    id: id(),
    selectionId: uuid("selection_id")
      .notNull()
      .unique()
      .references(() => recruitmentSelections.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    summary: text("summary"),
    duties: text("duties"),
    requirements: text("requirements"),
    employmentType: workTimeEnum("employment_type"),
    workTime: workTimeEnum("work_time"),
    workMode: workModeEnum("work_mode"),
    salaryMin: numeric("salary_min", { precision: 10, scale: 2, mode: "number" }),
    salaryMax: numeric("salary_max", { precision: 10, scale: 2, mode: "number" }),
    currency: char("currency", { length: 3 }),
    workingHours: varchar("working_hours", { length: 200 }),
    locationCity: varchar("location_city", { length: 100 }),
    locationProvince: varchar("location_province", { length: 2 }),
    locationRegion: varchar("location_region", { length: 60 }),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    check(
      "job_descriptions_salary_ck",
      sql`${t.salaryMin} IS NULL OR ${t.salaryMax} IS NULL OR ${t.salaryMax} >= ${t.salaryMin}`,
    ),
  ],
);

/** Pipeline configurabile: nessuno stage è cablato nel codice applicativo. */
export const recruitingStages = pgTable("recruiting_stages", {
  id: id(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull(),
  position: smallint("position").notNull(),
  active: boolean("active").notNull().default(true),
  isTerminal: boolean("is_terminal").notNull().default(false),
});

export const applications = pgTable(
  "applications",
  {
    id: id(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    selectionId: uuid("selection_id")
      .notNull()
      .references(() => recruitmentSelections.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => recruitingStages.id, { onDelete: "restrict" }),
    recruiterId: uuid("recruiter_id").references(() => users.id, { onDelete: "set null" }),
    source: applicationSourceEnum("source").notNull().default("MANUAL"),
    ...timestamps(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("applications_candidate_selection_uq").on(t.candidateId, t.selectionId),
    index("applications_candidate_idx").on(t.candidateId),
    index("applications_selection_idx").on(t.selectionId),
    index("applications_stage_idx").on(t.stageId),
    index("applications_recruiter_idx").on(t.recruiterId),
  ],
);

export const applicationEvaluations = pgTable(
  "application_evaluations",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    result: evaluationResultEnum("result").notNull(),
    reason: text("reason"),
    notes: text("notes"),
    evaluatedBy: uuid("evaluated_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("application_evaluations_application_idx").on(t.applicationId, t.evaluatedAt),
    // Difesa in profondità: anche il database rifiuta un "non idoneo" senza motivazione.
    check(
      "application_evaluations_reason_ck",
      sql`${t.result} <> 'NOT_SUITABLE' OR (${t.reason} IS NOT NULL AND length(trim(${t.reason})) > 0)`,
    ),
  ],
);

export const interviews = pgTable(
  "interviews",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    recruiterId: uuid("recruiter_id").references(() => users.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes"),
    type: interviewTypeEnum("type").notNull().default("HR"),
    status: interviewStatusEnum("status").notNull().default("SCHEDULED"),
    location: varchar("location", { length: 200 }),
    meetingUrl: varchar("meeting_url", { length: 500 }),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    index("interviews_scheduled_at_idx").on(t.scheduledAt),
    index("interviews_recruiter_idx").on(t.recruiterId),
    index("interviews_application_idx").on(t.applicationId),
    check("interviews_duration_ck", sql`${t.durationMinutes} IS NULL OR ${t.durationMinutes} BETWEEN 5 AND 600`),
  ],
);

export const feedbacks = pgTable(
  "feedbacks",
  {
    id: id(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    interviewId: uuid("interview_id").references(() => interviews.id, { onDelete: "set null" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: feedbackTypeEnum("type").notNull().default("GENERAL"),
    content: text("content").notNull(),
    ...timestamps(),
  },
  (t) => [index("feedbacks_application_idx").on(t.applicationId, t.createdAt)],
);
