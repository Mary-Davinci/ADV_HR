import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import type { CareerBoard, PublicJobContent } from "@/domain/careers";

import { id, timestamps } from "./_shared";
import { candidates } from "./candidates";
import { documents } from "./operations";
import { applications, recruitmentSelections } from "./recruiting";

/** Explicit public snapshot: internal notes and company data are never serialized. */
export const careerPostings = pgTable(
  "career_postings",
  {
    id: id(),
    selectionId: uuid("selection_id")
      .notNull()
      .unique()
      .references(() => recruitmentSelections.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 240 }).notNull().unique(),
    board: varchar("board", { length: 20 }).$type<CareerBoard>().notNull(),
    content: jsonb("content").$type<PublicJobContent>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("career_postings_public_idx").on(t.board, t.publishedAt)],
);

/** Email proof precedes CV uploads. Raw bearer tokens are never stored. */
export const careerChallenges = pgTable(
  "career_challenges",
  {
    id: id(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    postingId: uuid("posting_id").references(() => careerPostings.id, { onDelete: "cascade" }),
    board: varchar("board", { length: 20 }).$type<CareerBoard>().notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("career_challenges_expiry_idx").on(t.expiresAt)],
);

/** Public submissions keep provenance and privacy acknowledgement, separately from HR notes. */
export const careerSubmissions = pgTable(
  "career_submissions",
  {
    id: id(),
    challengeId: uuid("challenge_id")
      .notNull()
      .unique()
      .references(() => careerChallenges.id),
    postingId: uuid("posting_id").references(() => careerPostings.id, { onDelete: "set null" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    possibleDuplicateId: uuid("possible_duplicate_id").references(() => candidates.id, { onDelete: "set null" }),
    message: text("message"),
    privacyUrl: text("privacy_url").notNull(),
    privacyVersion: varchar("privacy_version", { length: 40 }).notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [index("career_submissions_candidate_idx").on(t.candidateId)],
);
