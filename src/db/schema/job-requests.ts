import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import type { JobRequestForm, JobRequestFormValues } from "../../domain/job-request";
import { id, timestamps } from "./_shared";
import { jobRequestStatusEnum } from "./enums";
import { users } from "./identity";
import { documents } from "./operations";
import { companies, recruitmentSelections } from "./recruiting";

/**
 * Richiesta di personale di un'azienda (modulo "Job Description").
 * Il contenuto del modulo è un documento JSON validato dallo schema Zod
 * della feature; i dati strutturati per il matching finiscono nella
 * job description della selezione quando la richiesta viene approvata.
 */
export const jobRequests = pgTable(
  "job_requests",
  {
    id: id(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 20 }).notNull(),
    revision: integer("revision").notNull().default(1),
    status: jobRequestStatusEnum("status").notNull().default("DRAFT"),
    /** Valori inseriti, anche incompleti (bozza). */
    form: jsonb("form").$type<JobRequestFormValues>().notNull(),
    /** Modulo validato in modo completo: presente solo da READY in poi, fonte del PDF. */
    validatedForm: jsonb("validated_form").$type<JobRequestForm>(),
    signedDocumentId: uuid("signed_document_id").references(() => documents.id, { onDelete: "set null" }),
    selectionId: uuid("selection_id").references(() => recruitmentSelections.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    recipientEmail: varchar("recipient_email", { length: 254 }),
    /** SHA-256 del token del link personale: il token in chiaro non viene mai salvato. */
    accessTokenHash: varchar("access_token_hash", { length: 64 }),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("job_requests_code_uq").on(t.code),
    uniqueIndex("job_requests_access_token_uq").on(t.accessTokenHash),
    index("job_requests_company_idx").on(t.companyId),
    index("job_requests_status_idx").on(t.status),
  ],
);
