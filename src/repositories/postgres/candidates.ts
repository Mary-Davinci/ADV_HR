import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";

import {
  activePolicyParticipations,
  activities,
  applications,
  candidateCertifications,
  candidateDrivingLicenses,
  candidateEducation,
  candidateExperiences,
  candidateInterests,
  candidateLanguages,
  candidatePreferences,
  candidateProfiles,
  candidateSkills,
  candidateTags,
  candidates,
  companies,
  recruitingStages,
  recruitmentSelections,
  skills,
  tags,
  users,
  interviews,
} from "@/db/schema";
import {
  CONTACT_ACTIONS,
  getCandidateFullName,
  normalizeSkillName,
  professionSearchStem,
  type Candidate,
  type CandidatePreferences,
  type CandidateProfile,
  type CandidateSkill,
  type CandidateOrigin,
  type CandidateTrackingInput,
  type EducationLevel,
  type EntityId,
  type Page,
  type Skill,
} from "@/domain";

import type {
  CandidateAggregate,
  CandidateCollectionInput,
  CandidateCollectionKind,
  CandidateCollections,
  CandidateIdentityInput,
  CandidateListItem,
  CandidatePreferencesInput,
  CandidateProfileInput,
  CandidateRepository,
  CandidateSearchQuery,
  CandidateSkillInput,
  PositionMatch,
  PositionMatchQuery,
  PositionMatchSource,
  SkillRepository,
} from "../types";
import { containsText, escapeLike, pageBounds, searchTerms, sqlList, toCount, type Database } from "./db";

/* ------------------------------------------------------------------ */
/* Mapping                                                              */
/* ------------------------------------------------------------------ */

type CandidateRow = typeof candidates.$inferSelect;

function toCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    fiscalCode: row.fiscalCode,
    email: row.email,
    phone: row.phone,
    birthDate: row.birthDate,
    gender: row.gender,
    origin: row.origin,
    orientationCompletedOn: row.orientationCompletedOn,
    activatablePolicies: row.activatablePolicies,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toProfile(candidateId: EntityId, row: typeof candidateProfiles.$inferSelect | undefined): CandidateProfile {
  return {
    candidateId,
    residenceAddress: row?.residenceAddress ?? null,
    residenceCity: row?.residenceCity ?? null,
    residenceProvince: row?.residenceProvince ?? null,
    residenceRegion: row?.residenceRegion ?? null,
    residenceCountry: row?.residenceCountry ?? null,
    protectedCategory: row?.protectedCategory ?? "NOT_SPECIFIED",
    protectedCategoryNotes: row?.protectedCategoryNotes ?? null,
    employmentStatus: row?.employmentStatus ?? "UNKNOWN",
    professionalSummary: row?.professionalSummary ?? null,
    lastReviewedAt: row?.lastReviewedAt ?? null,
    updatedAt: row?.updatedAt ?? new Date(0),
  };
}

function toPreferences(
  candidateId: EntityId,
  row: typeof candidatePreferences.$inferSelect | undefined,
): CandidatePreferences {
  return {
    candidateId,
    availability: row?.availability ?? null,
    desiredEmploymentType: row?.desiredEmploymentType ?? null,
    desiredWorkTime: row?.desiredWorkTime ?? null,
    desiredWorkMode: row?.desiredWorkMode ?? null,
    willingToRelocate: row?.willingToRelocate ?? null,
    willingToTravel: row?.willingToTravel ?? null,
    preferredLocations: row?.preferredLocations ?? [],
    availabilityNotes: row?.availabilityNotes ?? null,
    updatedAt: row?.updatedAt ?? new Date(0),
  };
}

function stripTimestamps<T extends Record<string, unknown>>(row: T): Omit<T, "createdAt" | "updatedAt"> {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = row;
  return rest;
}

const COLLECTION_TABLES = {
  experiences: candidateExperiences,
  education: candidateEducation,
  interests: candidateInterests,
  languages: candidateLanguages,
  certifications: candidateCertifications,
  drivingLicenses: candidateDrivingLicenses,
  activePolicies: activePolicyParticipations,
} as const satisfies Record<CandidateCollectionKind, unknown>;

/**
 * Tutte le tabelle di collezione condividono le colonne `id` e `candidate_id`:
 * per costruire le query generiche si usa la forma di una di esse.
 */
function collectionTable(kind: CandidateCollectionKind) {
  return COLLECTION_TABLES[kind] as unknown as typeof candidateInterests;
}

/* ------------------------------------------------------------------ */
/* Frammenti SQL derivati (sempre parametrizzati)                       */
/* ------------------------------------------------------------------ */

const latestStageCode = sql<string | null>`(
  SELECT s.code FROM applications a
  JOIN recruiting_stages s ON s.id = a.stage_id
  WHERE a.candidate_id = ${candidates.id}
  ORDER BY a.updated_at DESC LIMIT 1
)`;

const nextInterviewAt = sql<Date | null>`(
  SELECT min(i.scheduled_at) FROM interviews i
  JOIN applications a ON a.id = i.application_id
  WHERE a.candidate_id = ${candidates.id} AND i.status = 'SCHEDULED' AND i.scheduled_at >= now()
)`.mapWith(interviews.scheduledAt);

const experienceMonths = sql<number>`(
  SELECT coalesce(sum(
    extract(year FROM age(coalesce(e.end_date, current_date), e.start_date)) * 12 +
    extract(month FROM age(coalesce(e.end_date, current_date), e.start_date))
  ), 0) FROM candidate_experiences e WHERE e.candidate_id = ${candidates.id}
)`;

/**
 * Grandi gruppi della classificazione ISTAT delle professioni: ADV CORE li mette in
 * `profilo_professionale` (copiato in `professional_summary`). Sono troppo generici per
 * dire che mestiere fa il candidato ("Professioni qualificate nelle attività commerciali
 * e nei servizi" non significa "commerciale"): non vengono usati nelle ricerche.
 */
const ISTAT_MACRO_GROUPS_SQL = `(
  'legislatori, imprenditori e alta dirigenza',
  'professioni intellettuali, scientifiche e di elevata specializzazione',
  'professioni tecniche',
  'impiegati',
  'professioni qualificate nelle attivita commerciali e nei servizi',
  'artigiani, operai specializzati e agricoltori',
  'conduttori di impianti e conducenti di veicoli',
  'professioni non qualificate',
  'forze armate',
  'nessuno'
)`;

/** Profilo testuale del candidato, senza la categoria ISTAT generica (alias `p` = profilo). */
const MEANINGFUL_SUMMARY_SQL = `CASE WHEN lower(unaccent(trim(p.professional_summary))) IN ${ISTAT_MACRO_GROUPS_SQL}
  THEN NULL ELSE p.professional_summary END`;

/** Il candidato arriva da ADV CORE (alias `adv` = record ADV CORE): lì il profilo è una nota libera, non un mestiere. */
const FROM_ADV_CORE_SQL = `adv.payload IS NOT NULL`;

/**
 * Campi ADV CORE non mappati in colonne ma utili a trovare mestiere e settore.
 * `profilo_professionale` è escluso: è già in `professional_summary` e va filtrato (vedi sopra).
 */
const ADV_CORE_PROFESSION_FIELDS = [
  "settore_esperienza",
  "settore_interesse",
  "titolo_studio",
  "certificazioni",
  "competenze_informatiche",
  "note_colloquio",
] as const;

/** Nomi di campo costanti (nessun input utente): sicuri come SQL letterale. */
const ADV_CORE_PROFESSION_SQL = `concat_ws(' ', ${ADV_CORE_PROFESSION_FIELDS.map((field) => `r.payload->>'${field}'`).join(", ")})`;
const advCoreProfessionText = sql.raw(ADV_CORE_PROFESSION_SQL);

/**
 * Il candidato ha il termine (mestiere, settore, competenza) in uno qualsiasi dei
 * dati professionali: profilo, esperienze, interessi, competenze, formazione,
 * certificazioni, dati ricevuti da ADV CORE e testo estratto dai CV.
 */
function matchesProfession(term: string): SQL {
  const pattern = `%${escapeLike(professionSearchStem(term))}%`;
  const like = (text: SQL) => sql`unaccent(coalesce(${text}, '')) ILIKE unaccent(${pattern})`;
  return sql`(
    ${like(sql`CASE WHEN lower(unaccent(trim(${candidateProfiles.professionalSummary}))) IN ${sql.raw(ISTAT_MACRO_GROUPS_SQL)}
      THEN NULL ELSE ${candidateProfiles.professionalSummary} END`)}
    OR EXISTS (SELECT 1 FROM candidate_experiences e WHERE e.candidate_id = ${candidates.id}
      AND ${like(sql`concat_ws(' ', e.role_title, e.sector, e.description)`)})
    OR EXISTS (SELECT 1 FROM candidate_interests ci WHERE ci.candidate_id = ${candidates.id} AND ${like(sql`ci.sector`)})
    OR EXISTS (SELECT 1 FROM candidate_skills cs JOIN skills sk ON sk.id = cs.skill_id
      WHERE cs.candidate_id = ${candidates.id} AND ${like(sql`sk.name`)})
    OR EXISTS (SELECT 1 FROM candidate_education ed WHERE ed.candidate_id = ${candidates.id}
      AND ${like(sql`concat_ws(' ', ed.qualification, ed.field_of_study)`)})
    OR EXISTS (SELECT 1 FROM candidate_certifications cc WHERE cc.candidate_id = ${candidates.id} AND ${like(sql`cc.name`)})
    OR EXISTS (SELECT 1 FROM legacy_mappings lm
      JOIN adv_core_records r ON r.entity_type = lm.entity_type AND r.legacy_id = lm.legacy_id
      WHERE lm.legacy_system = 'ADV_CORE' AND lm.entity_type = 'CANDIDATE' AND lm.adv_hr_id = ${candidates.id}
      AND ${like(advCoreProfessionText)})
    OR EXISTS (SELECT 1 FROM candidate_document_texts dt WHERE dt.candidate_id = ${candidates.id} AND ${like(sql`dt.content`)})
  )`;
}

/*
 * Testo professionale di un candidato (alias `c` = candidato, `p` = profilo) diviso per
 * affidabilità, per confrontare molte parole in una passata:
 * - "esperienza": ruoli e settori delle esperienze, settore di esperienza ADV CORE e il profilo
 *   dei candidati inseriti in ADV_HR (cosa ha fatto davvero il candidato);
 * - "interesse": settori di interesse dichiarati (cosa vorrebbe fare);
 * - "dettagli": descrizioni, competenze, formazione, certificazioni, note e profilo ADV CORE;
 * - "cv": testo estratto dai CV.
 * Richiedono gli alias `c` (candidato), `p` (profilo) e `adv` (record ADV CORE, anche assente).
 */

const professionExperienceText = sql.raw(`concat_ws(' ',
  CASE WHEN ${FROM_ADV_CORE_SQL} THEN NULL ELSE ${MEANINGFUL_SUMMARY_SQL} END,
  (SELECT string_agg(concat_ws(' ', e.role_title, e.sector), ' ') FROM candidate_experiences e WHERE e.candidate_id = c.id),
  adv.payload->>'settore_esperienza'
)`);

const professionInterestText = sql.raw(`concat_ws(' ',
  (SELECT string_agg(ci.sector, ' ') FROM candidate_interests ci WHERE ci.candidate_id = c.id),
  adv.payload->>'settore_interesse'
)`);

const professionDetailText = sql.raw(`concat_ws(' ',
  CASE WHEN ${FROM_ADV_CORE_SQL} THEN ${MEANINGFUL_SUMMARY_SQL} END,
  (SELECT string_agg(e.description, ' ') FROM candidate_experiences e WHERE e.candidate_id = c.id),
  (SELECT string_agg(sk.name, ' ') FROM candidate_skills cs JOIN skills sk ON sk.id = cs.skill_id WHERE cs.candidate_id = c.id),
  (SELECT string_agg(concat_ws(' ', ed.qualification, ed.field_of_study), ' ') FROM candidate_education ed WHERE ed.candidate_id = c.id),
  (SELECT string_agg(cc.name, ' ') FROM candidate_certifications cc WHERE cc.candidate_id = c.id),
  adv.payload->>'titolo_studio', adv.payload->>'certificazioni',
  adv.payload->>'competenze_informatiche', adv.payload->>'note_colloquio'
)`);

const professionCvText = sql.raw(
  `(SELECT string_agg(dt.content, ' ') FROM candidate_document_texts dt WHERE dt.candidate_id = c.id)`,
);

/** Sotto questa lunghezza un termine libero cerca solo nei dati anagrafici (evita risultati rumorosi). */
const MIN_PROFESSION_TERM_LENGTH = 3;

function buildConditions(query: CandidateSearchQuery): SQL[] {
  const conditions: SQL[] = [];

  for (const term of searchTerms(query.text)) {
    const clause = or(
      containsText(candidates.firstName, term),
      containsText(candidates.lastName, term),
      containsText(candidates.fiscalCode, term),
      containsText(candidates.email, term),
      containsText(candidateProfiles.residenceCity, term),
      term.length >= MIN_PROFESSION_TERM_LENGTH ? matchesProfession(term) : undefined,
    );
    if (clause) conditions.push(clause);
  }

  if (query.city) conditions.push(containsText(candidateProfiles.residenceCity, query.city));
  if (query.region) conditions.push(sql`lower(${candidateProfiles.residenceRegion}) = lower(${query.region})`);
  if (query.employmentStatus) conditions.push(eq(candidateProfiles.employmentStatus, query.employmentStatus));
  if (query.protectedCategory !== undefined) {
    conditions.push(
      query.protectedCategory
        ? inArray(candidateProfiles.protectedCategory, ["ART_1", "ART_18"])
        : sql`${candidateProfiles.protectedCategory} NOT IN ('ART_1', 'ART_18')`,
    );
  }
  if (query.willingToRelocate !== undefined) {
    conditions.push(eq(candidatePreferences.willingToRelocate, query.willingToRelocate));
  }
  if (query.workMode) conditions.push(eq(candidatePreferences.desiredWorkMode, query.workMode));
  if (query.workTime) {
    conditions.push(sql`${candidatePreferences.desiredWorkTime} IN (${query.workTime}, 'EITHER')`);
  }
  if (query.skill) {
    const normalized = normalizeSkillName(query.skill);
    conditions.push(sql`EXISTS (
      SELECT 1 FROM candidate_skills cs JOIN skills sk ON sk.id = cs.skill_id
      WHERE cs.candidate_id = ${candidates.id} AND sk.normalized_name ILIKE ${`%${normalized}%`}
    )`);
  }
  // "Settore o professione": ogni parola deve comparire nei dati professionali.
  for (const term of searchTerms(query.sector)) conditions.push(matchesProfession(term));
  if (query.drivingLicense) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM candidate_driving_licenses dl
      WHERE dl.candidate_id = ${candidates.id} AND dl.category = ${query.drivingLicense} AND dl.valid
    )`);
  }
  if (query.language) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM candidate_languages l
      WHERE l.candidate_id = ${candidates.id} AND lower(l.language) = lower(${query.language})
    )`);
  }
  if (query.activePolicy === "NONE") {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM active_policy_participations ap WHERE ap.candidate_id = ${candidates.id})`,
    );
  } else if (query.activePolicy || query.activePolicyYear) {
    const program = query.activePolicy && query.activePolicy !== "ANY" ? query.activePolicy : null;
    conditions.push(sql`EXISTS (
      SELECT 1 FROM active_policy_participations ap WHERE ap.candidate_id = ${candidates.id}
      ${program ? sql`AND ap.program_type = ${program}` : sql``}
      ${query.activePolicyYear ? sql`AND ap.reference_year = ${query.activePolicyYear}` : sql``}
    )`);
  }
  if (query.orientationCompleted !== undefined) {
    conditions.push(
      query.orientationCompleted
        ? isNotNull(candidates.orientationCompletedOn)
        : isNull(candidates.orientationCompletedOn),
    );
  }
  if (query.origin) conditions.push(eq(candidates.origin, query.origin));
  if (query.minExperienceMonths !== undefined && query.minExperienceMonths > 0) {
    conditions.push(sql`${experienceMonths} >= ${query.minExperienceMonths}`);
  }
  if (query.stageCodes?.length) {
    conditions.push(sql`${latestStageCode} IN (${sqlList(query.stageCodes)})`);
  }
  if (query.recruiterId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM applications a WHERE a.candidate_id = ${candidates.id} AND a.recruiter_id = ${query.recruiterId}
    )`);
  }
  if (query.interviewFrom || query.interviewTo) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM interviews i JOIN applications a ON a.id = i.application_id
      WHERE a.candidate_id = ${candidates.id} AND i.status = 'SCHEDULED'
      ${query.interviewFrom ? sql`AND i.scheduled_at >= ${query.interviewFrom}` : sql``}
      ${query.interviewTo ? sql`AND i.scheduled_at <= ${query.interviewTo}` : sql``}
    )`);
  }
  if (query.withoutInterview) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM interviews i JOIN applications a ON a.id = i.application_id
      WHERE a.candidate_id = ${candidates.id} AND i.status = 'SCHEDULED' AND i.scheduled_at >= now()
    )`);
  }
  return conditions;
}

/* ------------------------------------------------------------------ */
/* Repository                                                           */
/* ------------------------------------------------------------------ */

export class PostgresCandidateRepository implements CandidateRepository {
  constructor(private readonly db: Database) {}

  async search(query: CandidateSearchQuery): Promise<Page<CandidateListItem>> {
    const { limit, offset } = pageBounds(query);
    const where = and(...buildConditions(query));

    const order = (() => {
      switch (query.sort ?? "updatedAt_desc") {
        case "createdAt_desc":
          return [desc(candidates.createdAt)];
        case "lastName_asc":
          return [asc(sql`lower(${candidates.lastName})`), asc(sql`lower(${candidates.firstName})`)];
        case "interview_asc":
          return [sql`${nextInterviewAt} ASC NULLS LAST`, desc(candidates.updatedAt)];
        default:
          return [desc(candidates.updatedAt)];
      }
    })();

    const base = this.db
      .select({
        candidate: candidates,
        city: candidateProfiles.residenceCity,
        province: candidateProfiles.residenceProvince,
        employmentStatus: candidateProfiles.employmentStatus,
        protectedCategory: candidateProfiles.protectedCategory,
        availability: candidatePreferences.availability,
        nextInterviewAt,
        total: sql<number>`count(*) OVER ()::int`,
      })
      .from(candidates)
      .leftJoin(candidateProfiles, eq(candidateProfiles.candidateId, candidates.id))
      .leftJoin(candidatePreferences, eq(candidatePreferences.candidateId, candidates.id))
      .where(where)
      .orderBy(...order, asc(candidates.id))
      .limit(limit)
      .offset(offset);

    const rows = await base;
    const ids = rows.map((row) => row.candidate.id);
    const [latest, contacts] = await Promise.all([this.latestApplications(ids), this.lastContacts(ids)]);

    return {
      total: toCount(rows[0]?.total ?? 0),
      items: rows.map((row) => ({
        id: row.candidate.id,
        firstName: row.candidate.firstName,
        lastName: row.candidate.lastName,
        fiscalCode: row.candidate.fiscalCode,
        city: row.city,
        province: row.province,
        employmentStatus: row.employmentStatus ?? "UNKNOWN",
        protectedCategory: row.protectedCategory ?? "NOT_SPECIFIED",
        availability: row.availability,
        createdAt: row.candidate.createdAt,
        updatedAt: row.candidate.updatedAt,
        latestApplication: latest.get(row.candidate.id) ?? null,
        nextInterviewAt: row.nextInterviewAt ? new Date(row.nextInterviewAt) : null,
        lastContactAt: contacts.get(row.candidate.id) ?? null,
      })),
    };
  }

  private async latestApplications(ids: EntityId[]): Promise<Map<EntityId, CandidateListItem["latestApplication"]>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([applications.candidateId], {
        candidateId: applications.candidateId,
        id: applications.id,
        stageCode: recruitingStages.code,
        stageLabel: recruitingStages.label,
        selectionTitle: recruitmentSelections.title,
        companyName: companies.name,
        recruiterId: users.id,
        recruiterName: users.displayName,
      })
      .from(applications)
      .innerJoin(recruitingStages, eq(recruitingStages.id, applications.stageId))
      .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, applications.selectionId))
      .innerJoin(companies, eq(companies.id, recruitmentSelections.companyId))
      .leftJoin(users, eq(users.id, applications.recruiterId))
      .where(inArray(applications.candidateId, ids))
      .orderBy(applications.candidateId, desc(applications.updatedAt));

    return new Map(
      rows.map((row) => [
        row.candidateId,
        {
          id: row.id,
          stageCode: row.stageCode,
          stageLabel: row.stageLabel,
          selectionTitle: row.selectionTitle,
          companyName: row.companyName,
          recruiter:
            row.recruiterId && row.recruiterName ? { id: row.recruiterId, displayName: row.recruiterName } : null,
        },
      ]),
    );
  }

  private async lastContacts(ids: EntityId[]): Promise<Map<EntityId, Date>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        candidateId: activities.candidateId,
        lastContact: sql`max(${activities.createdAt})`.mapWith(activities.createdAt),
      })
      .from(activities)
      .where(and(inArray(activities.candidateId, ids), inArray(activities.action, [...CONTACT_ACTIONS])))
      .groupBy(activities.candidateId);
    return new Map(rows.flatMap((row) => (row.candidateId ? [[row.candidateId, row.lastContact] as const] : [])));
  }

  async getById(id: EntityId): Promise<Candidate | null> {
    const [row] = await this.db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    return row ? toCandidate(row) : null;
  }

  async findByFiscalCode(fiscalCode: string): Promise<Candidate | null> {
    const [row] = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.fiscalCode, fiscalCode.toUpperCase()))
      .limit(1);
    return row ? toCandidate(row) : null;
  }

  async getAggregate(id: EntityId): Promise<CandidateAggregate | null> {
    const candidate = await this.getById(id);
    if (!candidate) return null;

    const byCandidate = <T extends { candidateId: unknown }>(table: T) => eq(table.candidateId as never, id);

    const [
      profileRows,
      preferenceRows,
      experienceRows,
      educationRows,
      interestRows,
      skillRows,
      languageRows,
      certificationRows,
      licenseRows,
      policyRows,
      tagRows,
    ] = await Promise.all([
      this.db.select().from(candidateProfiles).where(byCandidate(candidateProfiles)),
      this.db.select().from(candidatePreferences).where(byCandidate(candidatePreferences)),
      this.db
        .select()
        .from(candidateExperiences)
        .where(byCandidate(candidateExperiences))
        .orderBy(desc(candidateExperiences.currentRole), desc(candidateExperiences.startDate)),
      this.db
        .select()
        .from(candidateEducation)
        .where(byCandidate(candidateEducation))
        .orderBy(sql`${candidateEducation.year} DESC NULLS LAST`),
      this.db
        .select()
        .from(candidateInterests)
        .where(byCandidate(candidateInterests))
        .orderBy(sql`${candidateInterests.priority} ASC NULLS LAST`),
      this.db
        .select({ link: candidateSkills, skill: skills })
        .from(candidateSkills)
        .innerJoin(skills, eq(skills.id, candidateSkills.skillId))
        .where(eq(candidateSkills.candidateId, id))
        .orderBy(sql`${candidateSkills.level} DESC NULLS LAST`, asc(skills.name)),
      this.db
        .select()
        .from(candidateLanguages)
        .where(byCandidate(candidateLanguages))
        .orderBy(asc(candidateLanguages.language)),
      this.db
        .select()
        .from(candidateCertifications)
        .where(byCandidate(candidateCertifications))
        .orderBy(sql`${candidateCertifications.issuedAt} DESC NULLS LAST`),
      this.db
        .select()
        .from(candidateDrivingLicenses)
        .where(byCandidate(candidateDrivingLicenses))
        .orderBy(asc(candidateDrivingLicenses.category)),
      this.db
        .select()
        .from(activePolicyParticipations)
        .where(byCandidate(activePolicyParticipations))
        .orderBy(desc(activePolicyParticipations.referenceYear)),
      this.db
        .select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(candidateTags)
        .innerJoin(tags, eq(tags.id, candidateTags.tagId))
        .where(eq(candidateTags.candidateId, id))
        .orderBy(asc(tags.name)),
    ]);

    return {
      candidate,
      profile: toProfile(id, profileRows[0]),
      preferences: toPreferences(id, preferenceRows[0]),
      experiences: experienceRows.map(stripTimestamps),
      education: educationRows.map(stripTimestamps),
      interests: interestRows.map(({ createdAt: _createdAt, ...rest }) => rest),
      skills: skillRows.map(({ link, skill }) => toCandidateSkill(link, skill)),
      languages: languageRows.map(stripTimestamps),
      certifications: certificationRows.map(stripTimestamps),
      drivingLicenses: licenseRows.map(stripTimestamps),
      activePolicies: policyRows.map(stripTimestamps),
      tags: tagRows,
    };
  }

  async create(input: CandidateIdentityInput): Promise<Candidate> {
    const [row] = await this.db.insert(candidates).values(normalizeIdentity(input)).returning();
    if (!row) throw new Error("Creazione candidato fallita");
    await this.db.insert(candidateProfiles).values({ candidateId: row.id }).onConflictDoNothing();
    await this.db.insert(candidatePreferences).values({ candidateId: row.id }).onConflictDoNothing();
    return toCandidate(row);
  }

  async updateIdentity(id: EntityId, input: CandidateIdentityInput): Promise<Candidate> {
    const [row] = await this.db
      .update(candidates)
      .set(normalizeIdentity(input))
      .where(eq(candidates.id, id))
      .returning();
    if (!row) throw new Error("Candidato non trovato");
    return toCandidate(row);
  }

  async upsertProfile(id: EntityId, input: CandidateProfileInput, reviewedAt: Date): Promise<CandidateProfile> {
    const values = {
      ...input,
      residenceProvince: input.residenceProvince?.toUpperCase() ?? null,
      lastReviewedAt: reviewedAt,
    };
    const [row] = await this.db
      .insert(candidateProfiles)
      .values({ candidateId: id, ...values })
      .onConflictDoUpdate({ target: candidateProfiles.candidateId, set: { ...values, updatedAt: new Date() } })
      .returning();
    return toProfile(id, row);
  }

  async upsertPreferences(id: EntityId, input: CandidatePreferencesInput): Promise<CandidatePreferences> {
    const [row] = await this.db
      .insert(candidatePreferences)
      .values({ candidateId: id, ...input })
      .onConflictDoUpdate({ target: candidatePreferences.candidateId, set: { ...input, updatedAt: new Date() } })
      .returning();
    return toPreferences(id, row);
  }

  async updateTracking(id: EntityId, input: CandidateTrackingInput): Promise<void> {
    await this.db
      .update(candidates)
      .set({
        origin: input.origin,
        orientationCompletedOn: input.orientationCompletedOn,
        activatablePolicies: [...new Set(input.activatablePolicies)],
      })
      .where(eq(candidates.id, id));
  }

  async markReviewed(id: EntityId, at: Date): Promise<void> {
    await this.db.update(candidates).set({ updatedAt: at }).where(eq(candidates.id, id));
    await this.db
      .insert(candidateProfiles)
      .values({ candidateId: id, lastReviewedAt: at })
      .onConflictDoUpdate({ target: candidateProfiles.candidateId, set: { lastReviewedAt: at } });
  }

  async addItem<K extends CandidateCollectionKind>(
    candidateId: EntityId,
    kind: K,
    input: CandidateCollectionInput<K>,
  ): Promise<CandidateCollections[K]> {
    const table = collectionTable(kind);
    const [row] = await this.db
      .insert(table)
      .values({ ...(input as object), candidateId } as typeof table.$inferInsert)
      .returning();
    if (!row) throw new Error("Inserimento non riuscito");
    return stripTimestamps(row as Record<string, unknown>) as unknown as CandidateCollections[K];
  }

  async updateItem<K extends CandidateCollectionKind>(
    candidateId: EntityId,
    kind: K,
    itemId: EntityId,
    input: CandidateCollectionInput<K>,
  ): Promise<CandidateCollections[K] | null> {
    const table = collectionTable(kind);
    const [row] = await this.db
      .update(table)
      .set(input as Partial<typeof table.$inferInsert>)
      .where(and(eq(table.id, itemId), eq(table.candidateId, candidateId)))
      .returning();
    return row ? (stripTimestamps(row as Record<string, unknown>) as unknown as CandidateCollections[K]) : null;
  }

  async removeItem(candidateId: EntityId, kind: CandidateCollectionKind, itemId: EntityId): Promise<boolean> {
    const table = collectionTable(kind);
    const rows = await this.db
      .delete(table)
      .where(and(eq(table.id, itemId), eq(table.candidateId, candidateId)))
      .returning({ id: table.id });
    return rows.length > 0;
  }

  async setSkill(candidateId: EntityId, input: CandidateSkillInput): Promise<CandidateSkill> {
    const normalizedName = normalizeSkillName(input.skillName);
    await this.db
      .insert(skills)
      .values({ name: input.skillName.trim(), category: input.category, normalizedName })
      .onConflictDoNothing({ target: skills.normalizedName });
    const [skill] = await this.db.select().from(skills).where(eq(skills.normalizedName, normalizedName)).limit(1);
    if (!skill) throw new Error("Skill non trovata");

    const values = {
      level: input.level,
      yearsExperience: input.yearsExperience,
      verified: input.verified,
      notes: input.notes,
    };
    const [link] = await this.db
      .insert(candidateSkills)
      .values({ candidateId, skillId: skill.id, ...values })
      .onConflictDoUpdate({
        target: [candidateSkills.candidateId, candidateSkills.skillId],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    if (!link) throw new Error("Salvataggio competenza non riuscito");
    return toCandidateSkill(link, skill);
  }

  async removeSkill(candidateId: EntityId, skillId: EntityId): Promise<boolean> {
    const rows = await this.db
      .delete(candidateSkills)
      .where(and(eq(candidateSkills.candidateId, candidateId), eq(candidateSkills.skillId, skillId)))
      .returning({ id: candidateSkills.skillId });
    return rows.length > 0;
  }

  async matchPosition(query: PositionMatchQuery): Promise<{ total: number; items: PositionMatch[] }> {
    if (query.roleKeywords.length === 0) return { total: 0, items: [] };
    const keywords = [
      ...query.roleKeywords.map((word) => ({ word, role: true })),
      ...query.bonusKeywords.map((word) => ({ word, role: false })),
    ].map(({ word, role }) => {
      const stem = professionSearchStem(word);
      // "commerciale" vale per commerciale/commerciali, non per commercialista o commercializzazione.
      const exact = `\\m${stem.replace(/[^a-z0-9]/g, "")}[a-z]{0,2}\\M`;
      return { word, role, pattern: `%${escapeLike(stem)}%`, exact };
    });
    const jobProvince = query.jobProvince?.trim().toUpperCase() || null;

    const result = (await this.db.execute(sql`
      WITH kw AS (
        SELECT t.k->>'word' AS word, t.k->>'pattern' AS pattern, t.k->>'exact' AS exact,
               (t.k->>'role')::boolean AS role, t.ord
        FROM jsonb_array_elements(${JSON.stringify(keywords)}::jsonb) WITH ORDINALITY AS t(k, ord)
      ),
      removed AS (
        SELECT ct.candidate_id FROM candidate_tags ct JOIN tags tg ON tg.id = ct.tag_id WHERE tg.slug = 'adv-core-rimosso'
      ),
      job_region AS (
        SELECT p.residence_region AS region FROM candidate_profiles p
        WHERE upper(p.residence_province) = ${jobProvince} AND p.residence_region IS NOT NULL
        GROUP BY p.residence_region ORDER BY count(*) DESC LIMIT 1
      ),
      prof AS MATERIALIZED (
        SELECT c.id,
               lower(unaccent(coalesce(${professionExperienceText}, ''))) AS exp,
               lower(unaccent(coalesce(${professionInterestText}, ''))) AS interest,
               lower(unaccent(coalesce(${professionDetailText}, ''))) AS detail,
               lower(unaccent(coalesce(${professionCvText}, ''))) AS cv
        FROM candidates c
        LEFT JOIN candidate_profiles p ON p.candidate_id = c.id
        LEFT JOIN LATERAL (
          SELECT r.payload FROM legacy_mappings lm
          JOIN adv_core_records r ON r.entity_type = lm.entity_type AND r.legacy_id = lm.legacy_id
          WHERE lm.legacy_system = 'ADV_CORE' AND lm.entity_type = 'CANDIDATE' AND lm.adv_hr_id = c.id
          LIMIT 1
        ) adv ON true
        WHERE c.id NOT IN (SELECT candidate_id FROM removed)
      ),
      found AS (
        SELECT prof.id, kw.word, kw.ord, kw.role,
               prof.exp LIKE kw.pattern AS in_exp, prof.exp ~ kw.exact AS exact_exp, prof.cv LIKE kw.pattern AS in_cv,
               prof.interest LIKE kw.pattern AS in_interest, prof.detail LIKE kw.pattern AS in_detail
        FROM prof JOIN kw ON prof.exp LIKE kw.pattern OR prof.cv LIKE kw.pattern
                          OR prof.interest LIKE kw.pattern OR prof.detail LIKE kw.pattern
      ),
      hits AS MATERIALIZED (
        SELECT id,
               array_agg(word ORDER BY ord) AS matched,
               coalesce(array_agg(word ORDER BY ord) FILTER (WHERE NOT role), '{}') AS requirements,
               bool_or(role AND in_exp) AS role_exp, bool_or(role AND exact_exp) AS role_exact,
               bool_or(role AND in_cv) AS role_cv,
               bool_or(role AND in_interest) AS role_interest, bool_or(role AND in_detail) AS role_detail,
               count(*) FILTER (WHERE role) AS role_hits, count(*) FILTER (WHERE NOT role) AS requirement_hits
        FROM found GROUP BY id HAVING bool_or(role)
      ),
      enriched AS MATERIALIZED (
        SELECT h.*, c.first_name, c.last_name, c.id AS candidate_id,
               pr.residence_city, pr.residence_province, pr.residence_region, c.origin,
               c.orientation_completed_on IS NOT NULL AS orientation_completed,
               EXISTS (SELECT 1 FROM active_policy_participations ap WHERE ap.candidate_id = c.id) AS has_active_policy,
               coalesce(upper(pr.residence_province) = ${jobProvince}, false) AS same_province,
               coalesce(pr.residence_region = (SELECT region FROM job_region), false) AS same_region,
               adv.payload,
               -- Anni dichiarati in ADV CORE (valori non plausibili scartati), altrimenti dalle esperienze.
               coalesce(
                 CASE WHEN adv.payload->>'esperienza_anni' ~ '^[0-9]{1,2}$' AND (adv.payload->>'esperienza_anni')::int <= 50
                      THEN (adv.payload->>'esperienza_anni')::int
                        + CASE WHEN adv.payload->>'esperienza_mesi' ~ '^[0-9]{1,2}$' AND (adv.payload->>'esperienza_mesi')::int <= 11
                               THEN (adv.payload->>'esperienza_mesi')::numeric / 12 ELSE 0 END END,
                 nullif((SELECT sum(extract(year FROM age(coalesce(e.end_date, current_date), e.start_date)) * 12
                                   + extract(month FROM age(coalesce(e.end_date, current_date), e.start_date)))
                         FROM candidate_experiences e WHERE e.candidate_id = c.id), 0) / 12
               ) AS years,
               coalesce(nullif(trim(adv.payload->>'settore_esperienza'), ''),
                 (SELECT string_agg(DISTINCT e.role_title, ', ') FROM candidate_experiences e WHERE e.candidate_id = c.id)
               ) AS experience_sector,
               coalesce(nullif(trim(adv.payload->>'settore_interesse'), ''),
                 (SELECT string_agg(DISTINCT ci.sector, ', ') FROM candidate_interests ci WHERE ci.candidate_id = c.id)
               ) AS interest_sector,
               (SELECT (array_agg(ed.level ORDER BY array_position(
                   ARRAY['LOWER_SECONDARY','VOCATIONAL','UPPER_SECONDARY','POST_SECONDARY','BACHELOR','MASTER','DOCTORATE']::text[],
                   ed.level::text) DESC NULLS LAST))[1]
                FROM candidate_education ed WHERE ed.candidate_id = c.id) AS education_level,
               EXISTS (SELECT 1 FROM documents d WHERE d.candidate_id = c.id AND d.type = 'CV') AS has_cv,
               (SELECT d.id FROM documents d WHERE d.candidate_id = c.id AND d.type = 'CV'
                 ORDER BY (EXISTS (SELECT 1 FROM candidate_document_texts t WHERE t.document_id = d.id AND t.status = 'OK')) DESC,
                          d.created_at DESC LIMIT 1) AS cv_document_id,
               (SELECT d.mime_type FROM documents d WHERE d.candidate_id = c.id AND d.type = 'CV'
                 ORDER BY (EXISTS (SELECT 1 FROM candidate_document_texts t WHERE t.document_id = d.id AND t.status = 'OK')) DESC,
                          d.created_at DESC LIMIT 1) AS cv_mime_type,
               EXISTS (SELECT 1 FROM candidate_document_texts t WHERE t.candidate_id = c.id AND t.status = 'OK') AS has_readable_cv,
               EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.selection_id = ${query.selectionId})
                 AS in_selection
        FROM hits h
        JOIN candidates c ON c.id = h.id
        LEFT JOIN candidate_profiles pr ON pr.candidate_id = c.id
        LEFT JOIN LATERAL (
          SELECT r.payload FROM legacy_mappings lm
          JOIN adv_core_records r ON r.entity_type = lm.entity_type AND r.legacy_id = lm.legacy_id
          WHERE lm.legacy_system = 'ADV_CORE' AND lm.entity_type = 'CANDIDATE' AND lm.adv_hr_id = c.id
          LIMIT 1
        ) adv ON true
      )
      SELECT e.*, count(*) OVER ()::int AS total
      FROM enriched e
      -- Ordine dichiarato a HR: dove compare la figura (esperienza con la parola esatta > esperienza
      -- con parola simile > CV > interesse > altri dati),
      -- fascia di esperienza (5+ anni, 2-4, 1), vicinanza alla sede (provincia, regione),
      -- requisiti trovati, poi anni esatti e CV leggibile. Nessun criterio legato alla data di modifica.
      ORDER BY
        CASE WHEN e.role_exact THEN 4 WHEN e.role_exp THEN 3 WHEN e.role_cv THEN 2 WHEN e.role_interest THEN 1 ELSE 0 END DESC,
        CASE WHEN e.years >= 5 THEN 3 WHEN e.years >= 2 THEN 2 WHEN e.years >= 1 THEN 1 ELSE 0 END DESC,
        (e.same_province::int * 2 + e.same_region::int) DESC,
        e.requirement_hits DESC, e.role_hits DESC, e.years DESC NULLS LAST, e.has_readable_cv DESC,
        e.last_name, e.first_name, e.candidate_id
      LIMIT ${query.limit}
    `)) as unknown as { rows: PositionMatchRow[] };

    const yesNo = (value: unknown) => (value === "SI" ? true : value === "NO" ? false : null);
    const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

    return {
      total: toCount(result.rows[0]?.total ?? 0),
      items: result.rows.map((row) => {
        const roleFoundIn: PositionMatchSource[] = [];
        if (row.role_exp) roleFoundIn.push("EXPERIENCE");
        if (row.role_cv) roleFoundIn.push("CV");
        if (row.role_interest) roleFoundIn.push("INTEREST");
        if (row.role_detail) roleFoundIn.push("DETAILS");
        const payload = row.payload ?? {};
        const license = text(payload.patente);
        return {
          candidateId: row.candidate_id,
          firstName: row.first_name,
          lastName: row.last_name,
          city: row.residence_city,
          province: row.residence_province,
          matchedKeywords: row.matched,
          roleInProfile: row.role_exp,
          roleFoundIn,
          matchedRequirements: row.requirements,
          experienceYears: row.years === null ? null : Math.round(Number(row.years) * 10) / 10,
          experienceSector: row.experience_sector?.slice(0, 160) ?? null,
          interestSector: row.interest_sector?.slice(0, 160) ?? null,
          educationLevel: row.education_level,
          drivingLicense: license && license !== "Nessuna" ? license : null,
          availableToRelocate: yesNo(payload.disponibilita_trasferimento),
          availableToTravel: yesNo(payload.disponibilita_trasferte),
          workMode: text(payload.modalita_lavoro),
          employmentStatus: text(payload.stato_occupazionale),
          sameProvince: row.same_province,
          sameRegion: row.same_region,
          region: row.residence_region,
          hasActivePolicy: row.has_active_policy,
          orientationCompleted: row.orientation_completed,
          origin: row.origin,
          hasCv: row.has_cv,
          hasReadableCv: row.has_readable_cv,
          cvDocumentId: row.cv_document_id,
          cvViewable: ["application/pdf", "image/jpeg", "image/png"].includes(row.cv_mime_type ?? ""),
          alreadyInSelection: row.in_selection,
        };
      }),
    };
  }

  async lookup(text: string, limit: number) {
    const terms = searchTerms(text);
    const conditions = terms.flatMap((term) => {
      const clause = or(
        containsText(candidates.firstName, term),
        containsText(candidates.lastName, term),
        containsText(candidates.fiscalCode, term),
      );
      return clause ? [clause] : [];
    });
    const rows = await this.db
      .select({ candidate: candidates, city: candidateProfiles.residenceCity })
      .from(candidates)
      .leftJoin(candidateProfiles, eq(candidateProfiles.candidateId, candidates.id))
      .where(and(...conditions))
      .orderBy(asc(sql`lower(${candidates.lastName})`))
      .limit(Math.min(limit, 50));
    return rows.map((row) => ({ id: row.candidate.id, fullName: getCandidateFullName(row.candidate), city: row.city }));
  }
}

interface PositionMatchRow {
  candidate_id: string;
  first_name: string;
  last_name: string;
  residence_city: string | null;
  residence_province: string | null;
  residence_region: string | null;
  origin: CandidateOrigin;
  orientation_completed: boolean;
  has_active_policy: boolean;
  same_province: boolean;
  same_region: boolean;
  payload: Record<string, unknown> | null;
  years: string | number | null;
  experience_sector: string | null;
  interest_sector: string | null;
  education_level: EducationLevel | null;
  matched: string[];
  requirements: string[];
  role_exp: boolean;
  role_exact: boolean;
  role_cv: boolean;
  role_interest: boolean;
  role_detail: boolean;
  has_cv: boolean;
  has_readable_cv: boolean;
  cv_document_id: string | null;
  cv_mime_type: string | null;
  in_selection: boolean;
  total: number;
}

function toCandidateSkill(
  link: typeof candidateSkills.$inferSelect,
  skill: typeof skills.$inferSelect,
): CandidateSkill {
  return {
    candidateId: link.candidateId,
    skill: { id: skill.id, name: skill.name, category: skill.category, normalizedName: skill.normalizedName },
    level: link.level,
    yearsExperience: link.yearsExperience,
    verified: link.verified,
    notes: link.notes,
  };
}

function normalizeIdentity(input: CandidateIdentityInput) {
  return {
    ...input,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    fiscalCode: input.fiscalCode?.trim().toUpperCase() || null,
    email: input.email?.trim().toLowerCase() || null,
  };
}

export class PostgresSkillRepository implements SkillRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Skill[]> {
    const rows = await this.db.select().from(skills).orderBy(asc(skills.name));
    return rows.map(({ createdAt: _createdAt, ...skill }) => skill);
  }
}
