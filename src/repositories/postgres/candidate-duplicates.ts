import { and, asc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { candidates } from "@/db/schema";
import { DomainRuleError, type EntityId } from "@/domain";
import type { CandidateIdentityInput } from "../types";
import type { Database } from "./db";

const normalizedName = (first: SQL, last: SQL) =>
  sql`lower(unaccent(regexp_replace(trim(${first} || ' ' || ${last}), '[[:space:]]+', ' ', 'g')))`;
const normalizedEmail = (value: SQL) => sql`nullif(lower(trim(${value})), '')`;
const normalizedPhone = (value: SQL) =>
  sql`nullif(regexp_replace(regexp_replace(${value}, '[^0-9]', '', 'g'), '^(0039|39(?=[0-9]{10}$))', ''), '')`;

export async function findCandidateDuplicates(
  db: Database,
  input: Pick<CandidateIdentityInput, "firstName" | "lastName" | "email" | "phone" | "fiscalCode">,
  excludeId?: EntityId,
) {
  const phone = sql`length(${normalizedPhone(sql`${input.phone}`)}) >= 7 AND ${normalizedPhone(sql`${candidates.phone}`)} = ${normalizedPhone(sql`${input.phone}`)}`;
  const email = sql`${normalizedEmail(sql`${candidates.email}`)} = ${normalizedEmail(sql`${input.email}`)}`;
  const name = sql`${normalizedName(sql`${candidates.firstName}`, sql`${candidates.lastName}`)} = ${normalizedName(sql`${input.firstName}`, sql`${input.lastName}`)}`;
  const fiscal = input.fiscalCode ? eq(candidates.fiscalCode, input.fiscalCode.toUpperCase()) : sql`false`;
  return db
    .select({
      candidate: candidates,
      reasons: sql<
        string[]
      >`array_remove(ARRAY[CASE WHEN ${phone} THEN 'Stesso telefono' END, CASE WHEN ${email} THEN 'Stessa email' END, CASE WHEN ${name} THEN 'Stesso nome e cognome' END, CASE WHEN ${fiscal} THEN 'Stesso codice fiscale' END], NULL)`,
    })
    .from(candidates)
    .where(and(or(phone, email, name, fiscal), excludeId ? ne(candidates.id, excludeId) : undefined))
    .orderBy(asc(candidates.id))
    .limit(30);
}

export async function candidateDuplicatePairs(db: Database) {
  // Normalize each record once and join by equal keys, rather than comparing every candidate pair.
  const result = await db.execute(sql`WITH normalized AS MATERIALIZED (
    SELECT id, ${normalizedPhone(sql`${candidates.phone}`)} AS phone,
      ${normalizedEmail(sql`${candidates.email}`)} AS email,
      ${normalizedName(sql`${candidates.firstName}`, sql`${candidates.lastName}`)} AS name FROM candidates
  ), keys AS MATERIALIZED (
    SELECT id, 'phone:' || phone AS key, 'Stesso telefono' AS reason FROM normalized WHERE length(phone) >= 7
    UNION ALL SELECT id, 'email:' || email, 'Stessa email' FROM normalized WHERE email IS NOT NULL
    UNION ALL SELECT id, 'name:' || name, 'Stesso nome e cognome' FROM normalized WHERE name <> ''
  ) SELECT a.id AS left_id, b.id AS right_id, array_agg(DISTINCT a.reason ORDER BY a.reason) AS reasons
    FROM keys a JOIN keys b ON a.key = b.key AND a.id < b.id GROUP BY a.id, b.id ORDER BY a.id, b.id LIMIT 200`);
  const pairs = (result as unknown as { rows: Array<{ left_id: string; right_id: string; reasons: string[] }> }).rows;
  if (!pairs.length) return [];
  const people = await db
    .select()
    .from(candidates)
    .where(inArray(candidates.id, [...new Set(pairs.flatMap((pair) => [pair.left_id, pair.right_id]))]));
  const byId = new Map(people.map((candidate) => [candidate.id, candidate]));
  return pairs.flatMap((pair) => {
    const left = byId.get(pair.left_id);
    const right = byId.get(pair.right_id);
    return left && right ? [{ left, right, reasons: pair.reasons }] : [];
  });
}

type Row = Record<string, unknown>;
async function rows(db: Database, table: string, column: string, id: string): Promise<Row[]> {
  const result = await db.execute(
    sql`SELECT row_to_json(t) AS value FROM ${sql.identifier(table)} t WHERE ${sql.identifier(column)} = ${id}`,
  );
  return (result as unknown as { rows: Array<{ value: Row }> }).rows.map((row) => row.value);
}
const empty = (value: unknown) =>
  value === null ||
  value === "" ||
  value === "UNKNOWN" ||
  value === "NOT_SPECIFIED" ||
  (Array.isArray(value) && value.length === 0);

/** Called only inside the service transaction. Table identifiers below are application constants. */
export async function mergeCandidateRecords(db: Database, sourceId: string, targetId: string, actorId: string) {
  if (sourceId === targetId) throw new DomainRuleError("Scegli due schede diverse.", "SAME_CANDIDATE");
  await db.execute(sql`SELECT id FROM candidates WHERE id IN (${sourceId}, ${targetId}) ORDER BY id FOR UPDATE`);
  const [source] = await rows(db, "candidates", "id", sourceId);
  const [target] = await rows(db, "candidates", "id", targetId);
  if (!source || !target)
    throw new DomainRuleError("Una delle schede non esiste più. Aggiorna la pagina.", "CANDIDATE_MISSING");
  if (source.fiscal_code && target.fiscal_code && source.fiscal_code !== target.fiscal_code)
    throw new DomainRuleError(
      "I codici fiscali sono diversi: verifica e correggi l'anagrafica prima di unire le schede.",
      "FISCAL_CODE_CONFLICT",
    );

  const snapshot: Record<string, unknown> = { source, target };
  const singleton = ["candidate_profiles", "candidate_preferences"];
  const simple = [
    "candidate_experiences",
    "candidate_education",
    "candidate_interests",
    "candidate_languages",
    "candidate_certifications",
    "active_policy_participations",
    "documents",
    "candidate_document_texts",
    "tasks",
    "career_submissions",
    "notifications",
    "activities",
  ];
  const keyed = [
    ["candidate_tags", "tag_id"],
    ["candidate_skills", "skill_id"],
    ["candidate_driving_licenses", "category"],
    ["talent_pool_candidates", "talent_pool_id"],
    ["candidate_embeddings", "embedding_model"],
    ["matching_results", "run_id"],
  ];
  for (const table of [...singleton, ...simple, ...keyed.map(([table]) => table!), "applications"])
    snapshot[table] = await rows(db, table, "candidate_id", sourceId);
  for (const table of ["interviews", "application_evaluations", "feedbacks"]) {
    snapshot[table] = [];
    for (const application of snapshot.applications as Row[]) {
      (snapshot[table] as Row[]).push(...(await rows(db, table, "application_id", String(application.id))));
    }
  }

  // Fill empty fields; retain primary values and archive both versions for conflicts.
  async function fill(table: string, key: string, from: Row, to: Row) {
    const merged = { ...to };
    for (const [column, value] of Object.entries(from)) {
      if ([key, "id", "created_at", "updated_at"].includes(column)) continue;
      if (empty(to[column]) && !empty(value)) merged[column] = value;
    }
    if (table === "candidates") {
      merged.activatable_policies = [
        ...new Set([...(to.activatable_policies as string[]), ...(from.activatable_policies as string[])]),
      ];
      merged.tracking_notes = [to.tracking_notes, from.tracking_notes].filter(Boolean).join("\n\n") || null;
    }
    merged.updated_at = new Date().toISOString();
    const columns = Object.keys(merged).filter(
      (column) => column !== key && column !== "id" && column !== "created_at",
    );
    const names = sql.join(
      columns.map((column) => sql.identifier(column)),
      sql`, `,
    );
    await db.execute(
      sql`UPDATE ${sql.identifier(table)} SET (${names}) = (SELECT ${names} FROM jsonb_populate_record(NULL::${sql.identifier(table)}, ${JSON.stringify(merged)}::jsonb)) WHERE ${sql.identifier(key)} = ${targetId}`,
    );
  }
  // Transfer fiscal code only after releasing the source unique value.
  await db.update(candidates).set({ fiscalCode: null }).where(eq(candidates.id, sourceId));
  await fill("candidates", "id", source, target);
  for (const table of singleton) {
    const [from] = snapshot[table] as Row[];
    if (!from) continue;
    const [to] = await rows(db, table, "candidate_id", targetId);
    if (to) await fill(table, "candidate_id", from, to);
    else
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET candidate_id = ${targetId} WHERE candidate_id = ${sourceId}`,
      );
  }

  const sourceApplications = snapshot.applications as Row[];
  for (const application of sourceApplications) {
    const targetApplications = await rows(db, "applications", "candidate_id", targetId);
    const existing = targetApplications.find((row) => row.selection_id === application.selection_id);
    if (!existing) continue;
    const incomingEvaluations = await rows(db, "application_evaluations", "application_id", String(application.id));
    const primaryEvaluations = await rows(db, "application_evaluations", "application_id", String(existing.id));
    for (const table of [
      "interviews",
      "application_evaluations",
      "feedbacks",
      "documents",
      "tasks",
      "career_submissions",
    ]) {
      await db.execute(
        sql`UPDATE ${sql.identifier(table)} SET application_id = ${existing.id} WHERE application_id = ${application.id}`,
      );
    }
    if (incomingEvaluations.length) {
      const latest = primaryEvaluations.sort(
        (a, b) =>
          String(b.evaluated_at).localeCompare(String(a.evaluated_at)) || String(b.id).localeCompare(String(a.id)),
      )[0];
      const [stage] = await rows(db, "recruiting_stages", "id", String(existing.stage_id));
      const result =
        stage?.code === "REJECTED"
          ? "NOT_SUITABLE"
          : stage?.code === "SELECTED"
            ? "SUITABLE"
            : (latest?.result ?? "TO_REVIEW");
      const reason =
        result === "NOT_SUITABLE"
          ? (latest?.reason ?? "Candidatura principale già scartata prima dell'unione.")
          : (latest?.reason ?? null);
      // Current outcome belongs to the chosen primary application. Imported outcomes remain historical.
      await db.execute(sql`INSERT INTO application_evaluations (application_id, result, reason, notes, evaluated_by, evaluated_at)
        SELECT ${existing.id}, ${result}::evaluation_result, ${reason}, 'Unione schede: mantenuto lo stato della candidatura principale; esiti incorporati nello storico.', ${actorId},
        greatest(now(), coalesce(max(evaluated_at) + interval '1 microsecond', now())) FROM application_evaluations WHERE application_id = ${existing.id}`);
    }
    await db.execute(
      sql`UPDATE activities SET entity_id = ${existing.id} WHERE entity_type = 'APPLICATION' AND entity_id = ${application.id}`,
    );
    // The chosen primary application keeps its phase. Closed applications cannot retain appointments.
    if (existing.closed_at)
      await db.execute(
        sql`UPDATE interviews SET status = 'CANCELLED' WHERE application_id = ${existing.id} AND status = 'SCHEDULED'`,
      );
    await db.execute(sql`DELETE FROM applications WHERE id = ${application.id}`);
  }
  await db.execute(sql`UPDATE applications SET candidate_id = ${targetId} WHERE candidate_id = ${sourceId}`);
  await db.execute(sql`UPDATE interviews i SET status = 'CANCELLED' FROM applications a
    JOIN recruiting_stages stage ON stage.id = a.stage_id
    JOIN recruitment_selections selection ON selection.id = a.selection_id
    WHERE i.application_id = a.id AND a.candidate_id = ${targetId} AND i.status = 'SCHEDULED'
      AND (a.closed_at IS NOT NULL OR stage.is_terminal OR selection.status IN ('CLOSED', 'ARCHIVED'))`);
  for (const [table, unique] of keyed) {
    if (table === "matching_results") {
      await db.execute(
        sql`UPDATE matching_evidence e SET result_id = main.id FROM matching_results old JOIN matching_results main ON main.run_id = old.run_id AND main.candidate_id = ${targetId} WHERE old.candidate_id = ${sourceId} AND e.result_id = old.id`,
      );
    }
    await db.execute(
      sql`DELETE FROM ${sql.identifier(table!)} old WHERE old.candidate_id = ${sourceId} AND EXISTS (SELECT 1 FROM ${sql.identifier(table!)} main WHERE main.candidate_id = ${targetId} AND main.${sql.identifier(unique!)} = old.${sql.identifier(unique!)})`,
    );
    await db.execute(
      sql`UPDATE ${sql.identifier(table!)} SET candidate_id = ${targetId} WHERE candidate_id = ${sourceId}`,
    );
  }
  for (const table of simple)
    await db.execute(
      sql`UPDATE ${sql.identifier(table)} SET candidate_id = ${targetId} WHERE candidate_id = ${sourceId}`,
    );
  await db.execute(
    sql`UPDATE activities SET entity_id = ${targetId} WHERE entity_type = 'CANDIDATE' AND entity_id = ${sourceId}`,
  );
  await db.execute(
    sql`UPDATE career_submissions SET possible_duplicate_id = ${targetId} WHERE possible_duplicate_id = ${sourceId}`,
  );
  await db.execute(
    sql`UPDATE career_submissions SET possible_duplicate_id = NULL WHERE candidate_id = ${targetId} AND possible_duplicate_id = ${targetId}`,
  );
  await db.execute(
    sql`UPDATE notifications SET href = replace(href, ${sourceId}, ${targetId}) WHERE candidate_id = ${targetId}`,
  );
  await db.execute(
    sql`UPDATE legacy_mappings SET adv_hr_id = ${targetId} WHERE entity_type = 'CANDIDATE' AND adv_hr_id = ${sourceId}`,
  );
  // Restart three-way comparison for all linked identities: HR's chosen values win.
  await db.execute(
    sql`UPDATE adv_core_records r SET imported_values = '{}'::jsonb, payload_hash = NULL, flags = flags - 'duplicateOf' - 'possibleDuplicateIds' WHERE r.entity_type = 'CANDIDATE' AND r.legacy_id IN (SELECT legacy_id FROM legacy_mappings WHERE entity_type = 'CANDIDATE' AND adv_hr_id = ${targetId})`,
  );
  await db.execute(sql`UPDATE candidate_merges SET target_id = ${targetId} WHERE target_id = ${sourceId}`);
  await db.execute(
    sql`INSERT INTO candidate_merges (source_id, target_id, merged_by, snapshot) VALUES (${sourceId}, ${targetId}, ${actorId}, ${JSON.stringify(snapshot)}::jsonb)`,
  );
  await db.delete(candidates).where(eq(candidates.id, sourceId));
  const [main] = await db.select().from(candidates).where(eq(candidates.id, targetId));
  if (main && (await findCandidateDuplicates(db, main, targetId)).length === 0) {
    await db.execute(
      sql`DELETE FROM candidate_tags WHERE candidate_id = ${targetId} AND tag_id IN (SELECT id FROM tags WHERE slug = 'adv-core-duplicato')`,
    );
  }
}

export async function mergedCandidateTarget(db: Database, id: string) {
  const result = await db.execute(sql`SELECT target_id FROM candidate_merges WHERE source_id = ${id}`);
  return (result as unknown as { rows: Array<{ target_id: string }> }).rows[0]?.target_id ?? null;
}
