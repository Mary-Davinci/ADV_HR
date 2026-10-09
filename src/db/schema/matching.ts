import { index, jsonb, pgTable, text, uniqueIndex, uuid, varchar, vector } from "drizzle-orm/pg-core";

import { createdAt, id, timestamps } from "./_shared";
import { candidates } from "./candidates";
import { matchingEvidenceStatusEnum, matchingOverallStatusEnum, matchingRequirementCodeEnum } from "./enums";
import { users } from "./identity";
import { jobDescriptions, recruitmentSelections } from "./recruiting";

/**
 * Dimensione degli embedding. Fissata per il modello multilingue previsto
 * (1024 dimensioni, es. famiglia bge-m3 / e5-large). Cambiare modello con
 * dimensione diversa richiede una migration dedicata. Vedi docs/MATCHING.md.
 * In V1 NESSUN embedding viene generato.
 */
export const EMBEDDING_DIMENSIONS = 1024;

export const candidateEmbeddings = pgTable(
  "candidate_embeddings",
  {
    id: id(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    embeddingModel: varchar("embedding_model", { length: 120 }).notNull(),
    /** Hash del testo sorgente: evita di ricalcolare embedding invariati. */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("candidate_embeddings_candidate_model_uq").on(t.candidateId, t.embeddingModel),
    index("candidate_embeddings_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const jobDescriptionEmbeddings = pgTable(
  "job_description_embeddings",
  {
    id: id(),
    jobDescriptionId: uuid("job_description_id")
      .notNull()
      .references(() => jobDescriptions.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    embeddingModel: varchar("embedding_model", { length: 120 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("job_description_embeddings_jd_model_uq").on(t.jobDescriptionId, t.embeddingModel),
    index("job_description_embeddings_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/** Esecuzione del motore di matching su una selezione. Predisposta, non usata in V1. */
export const matchingRuns = pgTable(
  "matching_runs",
  {
    id: id(),
    selectionId: uuid("selection_id")
      .notNull()
      .references(() => recruitmentSelections.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    engineVersion: varchar("engine_version", { length: 40 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("matching_runs_selection_idx").on(t.selectionId, t.createdAt)],
);

export const matchingResults = pgTable(
  "matching_results",
  {
    id: id(),
    runId: uuid("run_id")
      .notNull()
      .references(() => matchingRuns.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    overallStatus: matchingOverallStatusEnum("overall_status").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("matching_results_run_candidate_uq").on(t.runId, t.candidateId)],
);

export const matchingEvidence = pgTable(
  "matching_evidence",
  {
    id: id(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => matchingResults.id, { onDelete: "cascade" }),
    requirementCode: matchingRequirementCodeEnum("requirement_code").notNull(),
    status: matchingEvidenceStatusEnum("status").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("matching_evidence_result_idx").on(t.resultId)],
);
