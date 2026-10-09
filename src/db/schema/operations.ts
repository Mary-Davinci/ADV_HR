import {
  bigint,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, id, timestamps } from "./_shared";
import { candidates } from "./candidates";
import {
  activityActionEnum,
  activityEntityTypeEnum,
  auditActionEnum,
  documentProcessingStatusEnum,
  documentTypeEnum,
  legacyEntityTypeEnum,
  legacySystemEnum,
  storageProviderEnum,
  taskPriorityEnum,
  taskStatusEnum,
} from "./enums";
import { users } from "./identity";
import { applications, companies, recruitmentSelections } from "./recruiting";

/**
 * Eventi di business che alimentano le timeline e l'"ultimo contatto".
 * `entity_type` + `entity_id` identificano il soggetto; `candidate_id`,
 * `selection_id`, `company_id` sono colonne di contesto per le timeline aggregate.
 * Nessuna FK sui riferimenti di contesto: la timeline sopravvive alle cancellazioni.
 */
export const activities = pgTable(
  "activities",
  {
    id: id(),
    entityType: activityEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: activityActionEnum("action").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    candidateId: uuid("candidate_id"),
    selectionId: uuid("selection_id"),
    companyId: uuid("company_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_entity_idx").on(t.entityType, t.entityId),
    index("activities_created_at_idx").on(t.createdAt),
    index("activities_candidate_idx").on(t.candidateId, t.createdAt),
    index("activities_selection_idx").on(t.selectionId, t.createdAt),
    index("activities_company_idx").on(t.companyId, t.createdAt),
  ],
);

/** Traccia tecnica delle modifiche: nessun dato sensibile (vedi domain/activity.ts). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    action: auditActionEnum("action").notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    assignedTo: uuid("assigned_to")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
    selectionId: uuid("selection_id").references(() => recruitmentSelections.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    status: taskStatusEnum("status").notNull().default("OPEN"),
    ...timestamps(),
  },
  (t) => [
    index("tasks_assigned_status_idx").on(t.assignedTo, t.status),
    index("tasks_due_at_idx").on(t.dueAt),
    index("tasks_candidate_idx").on(t.candidateId),
  ],
);

/** Metadati dei documenti. I file binari NON sono salvati nel database. */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    selectionId: uuid("selection_id").references(() => recruitmentSelections.id, { onDelete: "cascade" }),
    type: documentTypeEnum("type").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    storageProvider: storageProviderEnum("storage_provider").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    processingStatus: documentProcessingStatusEnum("processing_status").notNull().default("UPLOADED"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_candidate_idx").on(t.candidateId),
    index("documents_company_idx").on(t.companyId),
    index("documents_selection_idx").on(t.selectionId),
  ],
);

export const talentPools = pgTable("talent_pools", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const talentPoolCandidates = pgTable(
  "talent_pool_candidates",
  {
    talentPoolId: uuid("talent_pool_id")
      .notNull()
      .references(() => talentPools.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.talentPoolId, t.candidateId] }),
    index("talent_pool_candidates_candidate_idx").on(t.candidateId),
  ],
);

/**
 * Corrispondenze ADV_HR ↔ sistemi legacy. Predisposta, NON usata in V1:
 * sarà popolata dal futuro AdvCoreLegacyAdapter (docs/ADV_CORE_BRIDGE.md).
 */
export const legacyMappings = pgTable(
  "legacy_mappings",
  {
    id: id(),
    entityType: legacyEntityTypeEnum("entity_type").notNull(),
    advHrId: uuid("adv_hr_id").notNull(),
    legacySystem: legacySystemEnum("legacy_system").notNull(),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("legacy_mappings_legacy_uq").on(t.legacySystem, t.entityType, t.legacyId),
    uniqueIndex("legacy_mappings_adv_hr_uq").on(t.legacySystem, t.entityType, t.advHrId),
  ],
);
