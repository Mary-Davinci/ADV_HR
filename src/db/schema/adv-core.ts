import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { createdAt, id } from "./_shared";
import { advCoreSyncStatusEnum, advCoreSyncTriggerEnum, legacyEntityTypeEnum } from "./enums";

/** Un'esecuzione della sincronizzazione ADV CORE (pianificata o manuale). */
export const advCoreSyncRuns = pgTable(
  "adv_core_sync_runs",
  {
    id: id(),
    trigger: advCoreSyncTriggerEnum("trigger").notNull(),
    status: advCoreSyncStatusEnum("status").notNull().default("RUNNING"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** Solo conteggi: nessun dato personale. */
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    errorMessage: text("error_message"),
  },
  (t) => [index("adv_core_sync_runs_started_at_idx").on(t.startedAt)],
);

/**
 * Stato di sincronizzazione di ogni record ADV CORE. Il collegamento con l'entità
 * ADV_HR resta in `legacy_mappings`; qui vivono i dati che servono al merge.
 */
export const advCoreRecords = pgTable(
  "adv_core_records",
  {
    id: id(),
    entityType: legacyEntityTypeEnum("entity_type").notNull(),
    legacyId: varchar("legacy_id", { length: 100 }).notNull(),
    /** Hash del payload + versione del mapping: se invariato il record non va rielaborato. */
    payloadHash: varchar("payload_hash", { length: 64 }),
    /** Ultimo payload ricevuto dall'API (campi non mappati, sedi, ...). */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    /** Valori scritti in ADV_HR all'ultima importazione: base del merge a tre vie. */
    importedValues: jsonb("imported_values").$type<Record<string, unknown>>().notNull().default({}),
    /** Campi modificati in ADV_HR e diversi in ADV CORE: { campo: { hr, advCore } }. */
    conflicts: jsonb("conflicts").$type<Record<string, { hr: unknown; advCore: unknown }>>().notNull().default({}),
    /** Segnalazioni (es. codice fiscale già usato da un altro record ADV CORE). */
    flags: jsonb("flags").$type<Record<string, unknown>>().notNull().default({}),
    /** Versione del file per i documenti (dimensione + data modifica). */
    fileVersion: varchar("file_version", { length: 80 }),
    skippedReason: varchar("skipped_reason", { length: 120 }),
    lastSeenRunId: uuid("last_seen_run_id").references(() => advCoreSyncRuns.id, { onDelete: "set null" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedReason: varchar("removed_reason", { length: 40 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("adv_core_records_legacy_uq").on(t.entityType, t.legacyId),
    index("adv_core_records_removed_idx")
      .on(t.entityType)
      .where(sql`${t.removedAt} IS NOT NULL`),
  ],
);
