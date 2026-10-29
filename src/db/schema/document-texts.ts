import { customType, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { candidates } from "./candidates";
import { documents } from "./operations";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

/**
 * Testo estratto IN LOCALE dai CV (nessun servizio esterno), per la ricerca
 * dei candidati suggeriti. `search_vector` è calcolato dall'applicazione con
 * la configurazione italiana e senza accenti (unaccent non è IMMUTABLE e non
 * può stare in una colonna generata).
 */
export const candidateDocumentTexts = pgTable(
  "candidate_document_texts",
  {
    documentId: uuid("document_id")
      .primaryKey()
      .references(() => documents.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    /** Esito: OK, EMPTY (es. scansione senza testo), UNSUPPORTED, FAILED. Non si riprova finché il file non cambia. */
    status: varchar("status", { length: 20 }).notNull(),
    content: text("content").notNull().default(""),
    charCount: integer("char_count").notNull().default(0),
    searchVector: tsvector("search_vector"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("candidate_document_texts_candidate_idx").on(t.candidateId),
    index("candidate_document_texts_search_idx").using("gin", t.searchVector),
  ],
);
