/**
 * Sincronizzazione ADV CORE → ADV_HR (sola lettura su ADV CORE).
 *
 * Ogni esecuzione scarica l'elenco COMPLETO di aziende e candidati (ADV CORE non aggiorna
 * in modo affidabile le date di modifica) e lo fonde con i dati ADV_HR con un merge a tre
 * vie: i campi modificati in ADV_HR non vengono mai sovrascritti. Vedi docs/ADV_CORE_BRIDGE.md.
 *
 * Nei log e nelle statistiche finiscono solo conteggi e id ADV CORE, mai dati personali.
 */
import { createHash, randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import {
  activePolicyParticipations,
  activities,
  advCoreRecords,
  advCoreSyncRuns,
  auditLogs,
  candidateEducation,
  candidatePreferences,
  candidateProfiles,
  candidates,
  candidateTags,
  companies,
  documents,
  legacyMappings,
  tags,
} from "@/db/schema";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  type AdvCoreSyncStatus,
  type AdvCoreSyncTrigger,
  type LegacyEntityType,
} from "@/domain";
import type { Database } from "@/repositories/postgres";
import { validateUpload } from "@/services/document-service";
import type { DocumentStorage } from "@/services/storage/document-storage";

import type { AdvCoreCandidate, AdvCoreClient, AdvCoreCompany } from "./client";
import {
  ADV_CORE_POLICY_NOTE_PREFIX,
  mapCandidate,
  mapCompany,
  MAPPING_VERSION,
  mergeFields,
  type Conflicts,
  type FieldMap,
  type MappedCandidate,
} from "./mapping";

export const SYNC_TAGS = {
  imported: { slug: "adv-core", name: "ADV Core" },
  conflict: { slug: "adv-core-conflitto", name: "ADV Core: dati diversi" },
  duplicate: { slug: "adv-core-duplicato", name: "ADV Core: CF duplicato" },
  removed: { slug: "adv-core-rimosso", name: "ADV Core: rimosso" },
} as const;

export interface SyncOptions {
  db: Database;
  client: AdvCoreClient;
  storage: DocumentStorage;
  trigger: AdvCoreSyncTrigger;
  /** Scarica anche i CV (default true). */
  syncDocuments?: boolean;
  now?: () => Date;
  log?: (message: string) => void;
  /** Download CV in parallelo. */
  documentConcurrency?: number;
}

export interface SyncSummary {
  runId: string;
  status: AdvCoreSyncStatus;
  stats: Record<string, number>;
  errorMessage: string | null;
}

type Stats = Record<string, number>;
type RecordRow = typeof advCoreRecords.$inferSelect;

const removedReasons = { deleted: "CANCELLATO_IN_ADV_CORE", missing: "NON_PIU_PRESENTE" } as const;

function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ v: MAPPING_VERSION, payload }))
    .digest("hex");
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Raggruppa i campi piatti "tabella.campo" per tabella. */
function splitFields(fields: FieldMap): Record<string, Record<string, unknown>> {
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(fields)) {
    const [table, column] = key.split(".") as [string, string];
    (grouped[table] ??= {})[column] = value;
  }
  return grouped;
}

function prefixed(table: string, row: Record<string, unknown> | undefined, keys: string[]): FieldMap {
  const fields: FieldMap = {};
  for (const key of keys) {
    const [prefix, column] = key.split(".") as [string, string];
    if (prefix !== table) continue;
    const value = row?.[column];
    fields[key] =
      value === undefined ? null : value instanceof Date ? value.toISOString() : (value as FieldMap[string]);
  }
  return fields;
}

export async function runAdvCoreSync(options: SyncOptions): Promise<SyncSummary> {
  const { db, client, storage } = options;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => undefined);
  const stats: Stats = {};
  const bump = (key: string, by = 1) => (stats[key] = (stats[key] ?? 0) + by);

  const [run] = await db.insert(advCoreSyncRuns).values({ trigger: options.trigger, startedAt: now() }).returning();
  const runId = run!.id;
  let status: AdvCoreSyncStatus = "SUCCESS";
  let errorMessage: string | null = null;

  const tagIds: Record<keyof typeof SYNC_TAGS, string> = {} as never;

  /* ---------------- helper comuni ---------------- */

  async function ensureTags() {
    for (const [key, tag] of Object.entries(SYNC_TAGS)) {
      await db.insert(tags).values(tag).onConflictDoNothing({ target: tags.slug });
      const [row] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, tag.slug));
      tagIds[key as keyof typeof SYNC_TAGS] = row!.id;
    }
  }

  async function setTag(tx: Database, candidateId: string, tag: keyof typeof SYNC_TAGS, on: boolean) {
    if (on) {
      await tx.insert(candidateTags).values({ candidateId, tagId: tagIds[tag] }).onConflictDoNothing();
    } else {
      await tx
        .delete(candidateTags)
        .where(and(eq(candidateTags.candidateId, candidateId), eq(candidateTags.tagId, tagIds[tag])));
    }
  }

  async function findMapping(tx: Database, entityType: LegacyEntityType, legacyId: string): Promise<string | null> {
    const [row] = await tx
      .select({ advHrId: legacyMappings.advHrId })
      .from(legacyMappings)
      .where(
        and(
          eq(legacyMappings.legacySystem, "ADV_CORE"),
          eq(legacyMappings.entityType, entityType),
          eq(legacyMappings.legacyId, legacyId),
        ),
      );
    return row?.advHrId ?? null;
  }

  async function legacyIdOf(tx: Database, entityType: LegacyEntityType, advHrId: string): Promise<string | null> {
    const [row] = await tx
      .select({ legacyId: legacyMappings.legacyId })
      .from(legacyMappings)
      .where(
        and(
          eq(legacyMappings.legacySystem, "ADV_CORE"),
          eq(legacyMappings.entityType, entityType),
          eq(legacyMappings.advHrId, advHrId),
        ),
      );
    return row?.legacyId ?? null;
  }

  async function loadRecords(entityType: LegacyEntityType): Promise<Map<string, RecordRow>> {
    const rows = await db.select().from(advCoreRecords).where(eq(advCoreRecords.entityType, entityType));
    return new Map(rows.map((row) => [row.legacyId, row]));
  }

  async function saveRecord(
    tx: Database,
    entityType: LegacyEntityType,
    legacyId: string,
    values: Partial<typeof advCoreRecords.$inferInsert>,
  ) {
    const row = { ...values, lastSeenRunId: runId, lastSeenAt: now() };
    await tx
      .insert(advCoreRecords)
      .values({ entityType, legacyId, ...row })
      .onConflictDoUpdate({ target: [advCoreRecords.entityType, advCoreRecords.legacyId], set: row });
  }

  /** Aggiorna solo "visto in questa esecuzione" per i record invariati. */
  async function touchSeen(entityType: LegacyEntityType, legacyIds: string[]) {
    for (let i = 0; i < legacyIds.length; i += 1_000) {
      await db
        .update(advCoreRecords)
        .set({ lastSeenRunId: runId, lastSeenAt: now() })
        .where(
          and(
            eq(advCoreRecords.entityType, entityType),
            inArray(advCoreRecords.legacyId, legacyIds.slice(i, i + 1_000)),
          ),
        );
    }
  }

  async function audit(
    tx: Database,
    entityType: "CANDIDATE" | "COMPANY" | "DOCUMENT",
    entityId: string,
    action: "CREATE" | "UPDATE" | "UPLOAD",
    changes: Record<string, unknown>,
    context: { candidateId?: string; companyId?: string },
  ) {
    // Solo nomi dei campi, mai valori (regola di audit di ADV_HR).
    await tx
      .insert(auditLogs)
      .values({ actorId: null, entityType, entityId, action, changes: { source: "ADV_CORE", ...changes } });
    const activityAction = action === "CREATE" ? "CREATED" : action === "UPLOAD" ? "DOCUMENT_UPLOADED" : "UPDATED";
    await tx.insert(activities).values({
      entityType,
      entityId,
      action: activityAction,
      actorId: null,
      candidateId: context.candidateId ?? null,
      companyId: context.companyId ?? null,
      metadata: { source: "ADV_CORE", ...changes },
    });
  }

  /* ---------------- aziende ---------------- */

  async function loadCompanyFields(tx: Database, id: string, keys: string[]): Promise<FieldMap> {
    const [row] = await tx.select().from(companies).where(eq(companies.id, id)).for("update");
    return prefixed("company", row as Record<string, unknown> | undefined, keys);
  }

  async function processCompany(row: AdvCoreCompany, record: RecordRow | undefined) {
    const legacyId = String(row.id);
    const removed = Boolean(row.data_cancellazione);
    const payloadHash = hashPayload(row);
    if (record && record.payloadHash === payloadHash && record.removedReason !== removedReasons.missing)
      return "unchanged";

    await db.transaction(async (tx) => {
      const incoming = mapCompany(row);
      const keys = Object.keys(incoming);
      const flags: Record<string, unknown> = {};
      let companyId = await findMapping(tx, "COMPANY", legacyId);
      let base: FieldMap | null = (record?.importedValues as FieldMap | undefined) ?? null;
      let created = false;

      if (!companyId) {
        const vat = incoming["company.vatNumber"] as string | null;
        const [existing] = vat
          ? await tx.select({ id: companies.id }).from(companies).where(eq(companies.vatNumber, vat))
          : [];
        if (existing) {
          const otherLegacy = await legacyIdOf(tx, "COMPANY", existing.id);
          if (otherLegacy) {
            // P.IVA già usata da un'altra azienda ADV CORE: nuova azienda senza P.IVA, da verificare.
            incoming["company.vatNumber"] = null;
            flags.duplicateOf = otherLegacy;
            bump("companiesDuplicateVat");
          } else {
            companyId = existing.id; // azienda già inserita in ADV_HR: si collega
            base = null;
            bump("companiesLinked");
          }
        }
        if (!companyId) {
          const values = splitFields(incoming).company as typeof companies.$inferInsert;
          const [inserted] = await tx
            .insert(companies)
            .values({ ...values, source: "ADV_CORE" })
            .returning({ id: companies.id });
          companyId = inserted!.id;
          base = incoming;
          created = true;
        }
        await tx
          .insert(legacyMappings)
          .values({ entityType: "COMPANY", advHrId: companyId, legacySystem: "ADV_CORE", legacyId });
      }

      let conflicts: Conflicts = {};
      let importedValues = incoming;
      if (created) {
        bump("companiesCreated");
        await audit(tx, "COMPANY", companyId, "CREATE", { legacyId }, { companyId });
      } else {
        const current = await loadCompanyFields(tx, companyId, keys);
        const merge = mergeFields(current, base, incoming, (record?.conflicts as Conflicts | undefined) ?? {});
        conflicts = merge.conflicts;
        importedValues = merge.base;
        const vat = merge.updates["company.vatNumber"];
        if (typeof vat === "string") {
          const [other] = await tx
            .select({ id: companies.id })
            .from(companies)
            .where(and(eq(companies.vatNumber, vat), ne(companies.id, companyId)));
          if (other) {
            delete merge.updates["company.vatNumber"];
            conflicts["company.vatNumber"] = { hr: current["company.vatNumber"] ?? null, advCore: vat };
          }
        }
        const updates = splitFields(merge.updates).company;
        if (updates) {
          await tx.update(companies).set(updates).where(eq(companies.id, companyId));
          bump("companiesUpdated");
          await audit(
            tx,
            "COMPANY",
            companyId,
            "UPDATE",
            { legacyId, fields: Object.keys(merge.updates) },
            { companyId },
          );
        }
      }
      if (Object.keys(conflicts).length) bump("companiesWithConflicts");

      await saveRecord(tx, "COMPANY", legacyId, {
        payloadHash,
        payload: row as unknown as Record<string, unknown>,
        importedValues,
        conflicts,
        flags: { ...((record?.flags as Record<string, unknown>) ?? {}), ...flags },
        removedAt: removed ? (record?.removedAt ?? now()) : null,
        removedReason: removed ? removedReasons.deleted : null,
      });
    });
    return "processed";
  }

  /* ---------------- candidati ---------------- */

  async function loadCandidateFields(tx: Database, id: string, keys: string[]): Promise<FieldMap> {
    const [candidate] = await tx.select().from(candidates).where(eq(candidates.id, id)).for("update");
    const [profile] = await tx.select().from(candidateProfiles).where(eq(candidateProfiles.candidateId, id));
    const [preferences] = await tx.select().from(candidatePreferences).where(eq(candidatePreferences.candidateId, id));
    return {
      ...prefixed("candidate", candidate as Record<string, unknown> | undefined, keys),
      ...prefixed("profile", profile as Record<string, unknown> | undefined, keys),
      ...prefixed("preferences", preferences as Record<string, unknown> | undefined, keys),
    };
  }

  async function writeCandidateFields(tx: Database, candidateId: string, fields: FieldMap) {
    const grouped = splitFields(fields);
    if (grouped.candidate) await tx.update(candidates).set(grouped.candidate).where(eq(candidates.id, candidateId));
    if (grouped.profile) {
      await tx
        .insert(candidateProfiles)
        .values({ candidateId, ...grouped.profile })
        .onConflictDoUpdate({ target: candidateProfiles.candidateId, set: grouped.profile });
    }
    if (grouped.preferences) {
      await tx
        .insert(candidatePreferences)
        .values({ candidateId, ...grouped.preferences })
        .onConflictDoUpdate({ target: candidatePreferences.candidateId, set: grouped.preferences });
    }
  }

  /**
   * La politica attiva di ADV CORE è una riga riconoscibile dal prefisso nelle note:
   * si sostituisce a ogni rielaborazione, le partecipazioni inserite in ADV_HR restano.
   */
  async function syncActivePolicy(tx: Database, candidateId: string, policy: MappedCandidate["activePolicy"]) {
    await tx
      .delete(activePolicyParticipations)
      .where(
        and(
          eq(activePolicyParticipations.candidateId, candidateId),
          sql`${activePolicyParticipations.notes} LIKE ${`${ADV_CORE_POLICY_NOTE_PREFIX}%`}`,
        ),
      );
    if (policy) {
      await tx.insert(activePolicyParticipations).values({ candidateId, ...policy });
      bump("activePolicies");
    }
  }

  async function processCandidate(row: AdvCoreCandidate, record: RecordRow | undefined) {
    const legacyId = String(row.id);
    const removed = Boolean(row.data_cancellazione);
    // I CV hanno un ciclo proprio: non devono far rielaborare l'anagrafica.
    const { cv: _cv, ...payload } = row;
    const payloadHash = hashPayload(payload);
    if (record && record.payloadHash === payloadHash && record.removedReason !== removedReasons.missing)
      return "unchanged";

    await db.transaction(async (tx) => {
      const mapped = mapCandidate(row, now());
      const incoming = mapped.fields;
      const keys = Object.keys(incoming);
      const flags: Record<string, unknown> = {};
      let candidateId = await findMapping(tx, "CANDIDATE", legacyId);
      let base: FieldMap | null = (record?.importedValues as FieldMap | undefined) ?? null;
      let created = false;

      if (!candidateId) {
        const fiscalCode = incoming["candidate.fiscalCode"] as string | null;
        const [existing] = fiscalCode
          ? await tx.select({ id: candidates.id }).from(candidates).where(eq(candidates.fiscalCode, fiscalCode))
          : [];
        if (existing) {
          const otherLegacy = await legacyIdOf(tx, "CANDIDATE", existing.id);
          if (otherLegacy) {
            // CF già usato da un altro candidato ADV CORE: nuovo candidato senza CF, da verificare.
            incoming["candidate.fiscalCode"] = null;
            flags.duplicateOf = otherLegacy;
            bump("candidatesDuplicateFiscalCode");
          } else {
            candidateId = existing.id; // candidato già inserito in ADV_HR: si collega
            base = null;
            bump("candidatesLinked");
          }
        }
        if (!candidateId) {
          const grouped = splitFields(incoming);
          const [inserted] = await tx
            .insert(candidates)
            .values({ ...(grouped.candidate as typeof candidates.$inferInsert), origin: "ADV_CORE" })
            .returning({ id: candidates.id });
          candidateId = inserted!.id;
          await tx.insert(candidateProfiles).values({ candidateId, ...grouped.profile });
          await tx.insert(candidatePreferences).values({ candidateId, ...grouped.preferences });
          if (mapped.education) await tx.insert(candidateEducation).values({ candidateId, ...mapped.education });
          base = incoming;
          created = true;
        }
        await tx
          .insert(legacyMappings)
          .values({ entityType: "CANDIDATE", advHrId: candidateId, legacySystem: "ADV_CORE", legacyId });
      }

      let conflicts: Conflicts = {};
      let importedValues = incoming;
      if (created) {
        bump("candidatesCreated");
        await audit(tx, "CANDIDATE", candidateId, "CREATE", { legacyId }, { candidateId });
      } else {
        const current = await loadCandidateFields(tx, candidateId, keys);
        const merge = mergeFields(current, base, incoming, (record?.conflicts as Conflicts | undefined) ?? {});
        conflicts = merge.conflicts;
        importedValues = merge.base;
        const fiscalCode = merge.updates["candidate.fiscalCode"];
        if (typeof fiscalCode === "string") {
          const [other] = await tx
            .select({ id: candidates.id })
            .from(candidates)
            .where(and(eq(candidates.fiscalCode, fiscalCode), ne(candidates.id, candidateId)));
          if (other) {
            delete merge.updates["candidate.fiscalCode"];
            conflicts["candidate.fiscalCode"] = { hr: current["candidate.fiscalCode"] ?? null, advCore: fiscalCode };
          }
        }
        if (Object.keys(merge.updates).length) {
          await writeCandidateFields(tx, candidateId, merge.updates);
          bump("candidatesUpdated");
          await audit(
            tx,
            "CANDIDATE",
            candidateId,
            "UPDATE",
            { legacyId, fields: Object.keys(merge.updates) },
            { candidateId },
          );
        }
      }

      await syncActivePolicy(tx, candidateId, mapped.activePolicy);

      const allFlags = { ...((record?.flags as Record<string, unknown>) ?? {}), ...flags };
      const hasConflicts = Object.keys(conflicts).length > 0;
      if (hasConflicts) bump("candidatesWithConflicts");
      await setTag(tx, candidateId, "imported", true);
      await setTag(tx, candidateId, "conflict", hasConflicts);
      await setTag(tx, candidateId, "duplicate", Boolean(allFlags.duplicateOf));
      await setTag(tx, candidateId, "removed", removed);

      await saveRecord(tx, "CANDIDATE", legacyId, {
        payloadHash,
        payload: payload as unknown as Record<string, unknown>,
        importedValues,
        conflicts,
        flags: allFlags,
        removedAt: removed ? (record?.removedAt ?? now()) : null,
        removedReason: removed ? removedReasons.deleted : null,
      });
    });
    return "processed";
  }

  /** Record non più restituiti da ADV CORE: segnalati, mai cancellati da ADV_HR. */
  async function markMissing(entityType: "CANDIDATE" | "COMPANY") {
    const missing = await db
      .update(advCoreRecords)
      .set({ removedAt: now(), removedReason: removedReasons.missing })
      .where(
        and(
          eq(advCoreRecords.entityType, entityType),
          isNull(advCoreRecords.removedAt),
          or(isNull(advCoreRecords.lastSeenRunId), ne(advCoreRecords.lastSeenRunId, runId)),
        ),
      )
      .returning({ legacyId: advCoreRecords.legacyId });
    bump(entityType === "CANDIDATE" ? "candidatesMissing" : "companiesMissing", missing.length);
    if (entityType !== "CANDIDATE") return;
    for (const { legacyId } of missing) {
      const candidateId = await findMapping(db, "CANDIDATE", legacyId);
      if (candidateId) await setTag(db, candidateId, "removed", true);
    }
  }

  /* ---------------- CV ---------------- */

  async function syncDocuments(rows: AdvCoreCandidate[]) {
    const records = await loadRecords("DOCUMENT");
    const unchanged: string[] = [];
    const queue: Array<{ candidateLegacyId: string; cv: AdvCoreCandidate["cv"][number] }> = [];
    for (const row of rows) {
      if (row.data_cancellazione) continue;
      for (const cv of row.cv ?? []) {
        if (!cv.disponibile) continue;
        const version = `${cv.dimensione_bytes ?? ""}|${cv.file_modificato_il ?? ""}`;
        const record = records.get(String(cv.id));
        if (record && record.fileVersion === version) unchanged.push(String(cv.id));
        else queue.push({ candidateLegacyId: String(row.id), cv });
      }
    }
    await touchSeen("DOCUMENT", unchanged);
    bump("cvUnchanged", unchanged.length);

    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          await importCv(job.candidateLegacyId, job.cv, records.get(String(job.cv.id)));
        } catch (error) {
          bump("cvErrors");
          log(`CV ${job.cv.id}: errore - ${errorText(error)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: options.documentConcurrency ?? 4 }, worker));
  }

  async function importCv(
    candidateLegacyId: string,
    cv: AdvCoreCandidate["cv"][number],
    record: RecordRow | undefined,
  ) {
    const legacyId = String(cv.id);
    const version = `${cv.dimensione_bytes ?? ""}|${cv.file_modificato_il ?? ""}`;
    const candidateId = await findMapping(db, "CANDIDATE", candidateLegacyId);
    if (!candidateId) return;

    const file = await options.client.downloadCv(cv.id);
    const mimeType = cv.tipo_file && ALLOWED_DOCUMENT_MIME_TYPES[cv.tipo_file] ? cv.tipo_file : file.mimeType;
    const extension = ALLOWED_DOCUMENT_MIME_TYPES[mimeType]?.[0] ?? "";
    const filename = `CV ADV Core ${cv.id}${extension}`;
    try {
      validateUpload({ name: filename, mimeType, bytes: file.bytes });
    } catch (error) {
      // Formato non gestito da ADV_HR (es. .p7m firmato): non si riprova finché il file non cambia.
      bump("cvSkipped");
      await saveRecord(db, "DOCUMENT", legacyId, {
        fileVersion: version,
        skippedReason: errorText(error).slice(0, 120),
      });
      return;
    }

    const storageKey = `adv-core/cv/${randomUUID()}`;
    await storage.put(storageKey, file.bytes);
    let oldKey: string | null = null;
    try {
      await db.transaction(async (tx) => {
        const documentId = await findMapping(tx, "DOCUMENT", legacyId);
        if (documentId) {
          const [previous] = await tx
            .select({ storageKey: documents.storageKey })
            .from(documents)
            .where(eq(documents.id, documentId));
          oldKey = previous?.storageKey ?? null;
          await tx
            .update(documents)
            .set({
              storageKey,
              storageProvider: storage.provider,
              mimeType,
              filename,
              sizeBytes: file.bytes.byteLength,
            })
            .where(eq(documents.id, documentId));
          bump("cvUpdated");
        } else {
          const [inserted] = await tx
            .insert(documents)
            .values({
              candidateId,
              type: "CV",
              filename,
              storageProvider: storage.provider,
              storageKey,
              mimeType,
              sizeBytes: file.bytes.byteLength,
              uploadedBy: null,
            })
            .returning({ id: documents.id });
          await tx
            .insert(legacyMappings)
            .values({ entityType: "DOCUMENT", advHrId: inserted!.id, legacySystem: "ADV_CORE", legacyId });
          await audit(tx, "DOCUMENT", inserted!.id, "UPLOAD", { legacyId, type: "CV" }, { candidateId });
          bump("cvCreated");
        }
        await saveRecord(tx, "DOCUMENT", legacyId, {
          fileVersion: version,
          skippedReason: null,
          flags: { ...(record?.flags ?? {}) },
        });
      });
    } catch (error) {
      await storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
    if (oldKey) await storage.delete(oldKey).catch(() => undefined);
  }

  /* ---------------- esecuzione ---------------- */

  try {
    const remote = await client.status();
    log(`ADV Core: ${remote.candidati} candidati, ${remote.aziende} aziende, ${remote.cv} CV`);
    const companyRows = await client.listCompanies();
    const candidateRows = await client.listCandidates();
    stats.remoteCompanies = companyRows.length;
    stats.remoteCandidates = candidateRows.length;

    // Elenco incompleto (es. dati cambiati durante il download): si importa ma non si
    // segnalano record come rimossi, per non generare falsi "non più presente".
    const complete = companyRows.length === remote.aziende && candidateRows.length === remote.candidati;
    if (!complete) {
      status = "PARTIAL";
      errorMessage = "Elenco ADV Core incompleto: rimozioni non applicate in questa esecuzione.";
      log(errorMessage);
    }

    await ensureTags();

    for (const [entityType, rows, process] of [
      ["COMPANY", companyRows, processCompany],
      ["CANDIDATE", candidateRows, processCandidate],
    ] as const) {
      const records = await loadRecords(entityType);
      const unchanged: string[] = [];
      const failed: string[] = [];
      for (const row of rows) {
        try {
          const result = await (process as (r: typeof row, rec: RecordRow | undefined) => Promise<string>)(
            row,
            records.get(String(row.id)),
          );
          if (result === "unchanged") unchanged.push(String(row.id));
        } catch (error) {
          failed.push(String(row.id));
          bump(entityType === "CANDIDATE" ? "candidateErrors" : "companyErrors");
          log(`${entityType} ${row.id}: errore - ${errorText(error)}`);
        }
      }
      // Anche i record in errore sono presenti in ADV CORE: non vanno segnalati come rimossi.
      await touchSeen(entityType, [...unchanged, ...failed]);
      bump(entityType === "CANDIDATE" ? "candidatesUnchanged" : "companiesUnchanged", unchanged.length);
      if (complete) await markMissing(entityType);
    }

    if (options.syncDocuments ?? true) await syncDocuments(candidateRows);

    const errors = (stats.candidateErrors ?? 0) + (stats.companyErrors ?? 0) + (stats.cvErrors ?? 0);
    if (errors > 0) {
      status = "PARTIAL";
      errorMessage = [errorMessage, `${errors} record con errori (dettaglio nel log del worker).`]
        .filter(Boolean)
        .join(" ");
    }
  } catch (error) {
    status = "FAILED";
    errorMessage = errorText(error);
    log(`Sincronizzazione fallita: ${errorMessage}`);
  } finally {
    await db
      .update(advCoreSyncRuns)
      .set({ status, finishedAt: now(), stats, errorMessage })
      .where(eq(advCoreSyncRuns.id, runId));
  }

  return { runId, status, stats, errorMessage };
}

/** Chiude come FAILED le esecuzioni rimaste RUNNING (processo interrotto, PC spento, ...). */
export async function closeStaleRuns(db: Database, olderThan: Date): Promise<number> {
  const rows = await db
    .update(advCoreSyncRuns)
    .set({ status: "FAILED", finishedAt: sql`now()`, errorMessage: "Esecuzione interrotta (processo terminato)." })
    .where(and(eq(advCoreSyncRuns.status, "RUNNING"), sql`${advCoreSyncRuns.startedAt} < ${olderThan}`))
    .returning({ id: advCoreSyncRuns.id });
  return rows.length;
}
