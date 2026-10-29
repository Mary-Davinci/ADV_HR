import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, id, timestamps } from "./_shared";
import {
  activePolicyProgramEnum,
  activePolicyStatusEnum,
  availabilityEnum,
  candidateOriginEnum,
  drivingLicenseCategoryEnum,
  educationLevelEnum,
  employmentStatusEnum,
  genderEnum,
  languageLevelEnum,
  protectedCategoryEnum,
  skillCategoryEnum,
  workModeEnum,
  workTimeEnum,
} from "./enums";

const candidateFk = () =>
  uuid("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" });

/** Identità essenziale del candidato. */
export const candidates = pgTable(
  "candidates",
  {
    id: id(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    /** Salvato in maiuscolo; univoco quando presente. */
    fiscalCode: varchar("fiscal_code", { length: 16 }),
    email: varchar("email", { length: 254 }),
    phone: varchar("phone", { length: 40 }),
    birthDate: date("birth_date", { mode: "string" }),
    gender: genderEnum("gender").notNull().default("NOT_SPECIFIED"),
    /** Da dove arriva il candidato; quelli importati da ADV CORE sono `ADV_CORE`. */
    origin: candidateOriginEnum("origin").notNull().default("MANUAL"),
    /** Percorso di orientamento completato (data); null = non completato. */
    orientationCompletedOn: date("orientation_completed_on", { mode: "string" }),
    /** Politiche attive attivabili secondo HR (non ancora sottoscritte). */
    activatablePolicies: activePolicyProgramEnum("activatable_policies")
      .array()
      .notNull()
      .default(sql`'{}'`),
    ...timestamps(),
  },
  (t) => [
    index("candidates_origin_idx").on(t.origin),
    index("candidates_last_name_idx").on(sql`lower(${t.lastName})`),
    uniqueIndex("candidates_fiscal_code_uq").on(t.fiscalCode),
    index("candidates_email_idx").on(sql`lower(${t.email})`),
    index("candidates_updated_at_idx").on(t.updatedAt),
  ],
);

export const candidateProfiles = pgTable(
  "candidate_profiles",
  {
    candidateId: uuid("candidate_id")
      .primaryKey()
      .references(() => candidates.id, { onDelete: "cascade" }),
    residenceAddress: varchar("residence_address", { length: 200 }),
    residenceCity: varchar("residence_city", { length: 100 }),
    residenceProvince: varchar("residence_province", { length: 2 }),
    residenceRegion: varchar("residence_region", { length: 60 }),
    residenceCountry: varchar("residence_country", { length: 2 }).default("IT"),
    protectedCategory: protectedCategoryEnum("protected_category").notNull().default("NOT_SPECIFIED"),
    protectedCategoryNotes: text("protected_category_notes"),
    employmentStatus: employmentStatusEnum("employment_status").notNull().default("UNKNOWN"),
    professionalSummary: text("professional_summary"),
    /** Aggiornato dal service a ogni modifica rilevante del profilo (vedi docs/DATABASE.md). */
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("candidate_profiles_city_idx").on(sql`lower(${t.residenceCity})`),
    index("candidate_profiles_region_idx").on(t.residenceRegion),
  ],
);

export const candidatePreferences = pgTable("candidate_preferences", {
  candidateId: uuid("candidate_id")
    .primaryKey()
    .references(() => candidates.id, { onDelete: "cascade" }),
  availability: availabilityEnum("availability"),
  desiredEmploymentType: workTimeEnum("desired_employment_type"),
  desiredWorkTime: workTimeEnum("desired_work_time"),
  desiredWorkMode: workModeEnum("desired_work_mode"),
  willingToRelocate: boolean("willing_to_relocate"),
  willingToTravel: boolean("willing_to_travel"),
  preferredLocations: text("preferred_locations").array(),
  availabilityNotes: text("availability_notes"),
  ...timestamps(),
});

export const candidateExperiences = pgTable(
  "candidate_experiences",
  {
    id: id(),
    candidateId: candidateFk(),
    companyName: varchar("company_name", { length: 160 }).notNull(),
    roleTitle: varchar("role_title", { length: 160 }).notNull(),
    sector: varchar("sector", { length: 100 }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    // duration_months NON è salvato: è derivato da start/end (domain/candidate.ts).
    description: text("description"),
    currentRole: boolean("current_role").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index("candidate_experiences_candidate_idx").on(t.candidateId),
    check("candidate_experiences_dates_ck", sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
  ],
);

export const candidateEducation = pgTable(
  "candidate_education",
  {
    id: id(),
    candidateId: candidateFk(),
    qualification: varchar("qualification", { length: 200 }).notNull(),
    fieldOfStudy: varchar("field_of_study", { length: 160 }),
    institution: varchar("institution", { length: 200 }),
    year: smallint("year"),
    level: educationLevelEnum("level").notNull(),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("candidate_education_candidate_idx").on(t.candidateId)],
);

export const candidateInterests = pgTable(
  "candidate_interests",
  {
    id: id(),
    candidateId: candidateFk(),
    sector: varchar("sector", { length: 100 }).notNull(),
    priority: smallint("priority"),
    createdAt: createdAt(),
  },
  (t) => [index("candidate_interests_candidate_idx").on(t.candidateId)],
);

export const skills = pgTable(
  "skills",
  {
    id: id(),
    name: varchar("name", { length: 100 }).notNull(),
    category: skillCategoryEnum("category").notNull().default("OTHER"),
    normalizedName: varchar("normalized_name", { length: 100 }).notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("skills_category_idx").on(t.category)],
);

export const candidateSkills = pgTable(
  "candidate_skills",
  {
    candidateId: candidateFk(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "restrict" }),
    level: smallint("level"),
    yearsExperience: smallint("years_experience"),
    verified: boolean("verified").notNull().default(false),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.candidateId, t.skillId] }),
    index("candidate_skills_skill_idx").on(t.skillId),
    check("candidate_skills_level_ck", sql`${t.level} IS NULL OR ${t.level} BETWEEN 1 AND 5`),
  ],
);

export const candidateLanguages = pgTable(
  "candidate_languages",
  {
    id: id(),
    candidateId: candidateFk(),
    language: varchar("language", { length: 60 }).notNull(),
    level: languageLevelEnum("level").notNull(),
    certified: boolean("certified").notNull().default(false),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    index("candidate_languages_candidate_idx").on(t.candidateId),
    index("candidate_languages_language_idx").on(sql`lower(${t.language})`),
  ],
);

export const candidateCertifications = pgTable(
  "candidate_certifications",
  {
    id: id(),
    candidateId: candidateFk(),
    name: varchar("name", { length: 200 }).notNull(),
    issuer: varchar("issuer", { length: 160 }),
    issuedAt: date("issued_at", { mode: "string" }),
    expiresAt: date("expires_at", { mode: "string" }),
    credentialId: varchar("credential_id", { length: 120 }),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("candidate_certifications_candidate_idx").on(t.candidateId)],
);

export const candidateDrivingLicenses = pgTable(
  "candidate_driving_licenses",
  {
    id: id(),
    candidateId: candidateFk(),
    category: drivingLicenseCategoryEnum("category").notNull(),
    valid: boolean("valid").notNull().default(true),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    index("candidate_driving_licenses_candidate_idx").on(t.candidateId),
    uniqueIndex("candidate_driving_licenses_uq").on(t.candidateId, t.category),
  ],
);

export const activePolicyParticipations = pgTable(
  "active_policy_participations",
  {
    id: id(),
    candidateId: candidateFk(),
    programType: activePolicyProgramEnum("program_type").notNull(),
    referenceYear: integer("reference_year").notNull(),
    status: activePolicyStatusEnum("status"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("active_policy_participations_candidate_idx").on(t.candidateId)],
);

export const tags = pgTable("tags", {
  id: id(),
  name: varchar("name", { length: 60 }).notNull(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  createdAt: createdAt(),
});

export const candidateTags = pgTable(
  "candidate_tags",
  {
    candidateId: candidateFk(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.candidateId, t.tagId] }), index("candidate_tags_tag_idx").on(t.tagId)],
);
