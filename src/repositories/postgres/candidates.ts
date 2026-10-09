import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";

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
  type Candidate,
  type CandidatePreferences,
  type CandidateProfile,
  type CandidateSkill,
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
  SkillRepository,
} from "../types";
import { containsText, pageBounds, searchTerms, sqlList, toCount, type Database } from "./db";

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

function buildConditions(query: CandidateSearchQuery): SQL[] {
  const conditions: SQL[] = [];

  for (const term of searchTerms(query.text)) {
    const clause = or(
      containsText(candidates.firstName, term),
      containsText(candidates.lastName, term),
      containsText(candidates.fiscalCode, term),
      containsText(candidates.email, term),
      containsText(candidateProfiles.residenceCity, term),
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
  if (query.sector) {
    const pattern = `%${query.sector}%`;
    conditions.push(sql`(
      EXISTS (SELECT 1 FROM candidate_experiences e WHERE e.candidate_id = ${candidates.id} AND unaccent(e.sector) ILIKE unaccent(${pattern}))
      OR EXISTS (SELECT 1 FROM candidate_interests ci WHERE ci.candidate_id = ${candidates.id} AND unaccent(ci.sector) ILIKE unaccent(${pattern}))
    )`);
  }
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
