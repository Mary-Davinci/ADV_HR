import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";

import {
  activities,
  applicationEvaluations,
  applications,
  candidateProfiles,
  candidates,
  companies,
  feedbacks,
  interviews,
  jobDescriptions,
  recruitingStages,
  recruitmentSelections,
  users,
} from "@/db/schema";
import {
  CONTACT_ACTIONS,
  getCandidateFullName,
  type Application,
  type ApplicationEvaluation,
  type Company,
  type EntityId,
  type JobDescription,
  type Page,
  type RecruitingStage,
  type RecruitmentSelection,
  type SelectionStatus,
} from "@/domain";

import type {
  ApplicationQuery,
  ApplicationRepository,
  ApplicationView,
  CompanyInput,
  CompanyListItem,
  CompanyQuery,
  CompanyRepository,
  JobDescriptionInput,
  JobDescriptionRepository,
  RecruitingStageRepository,
  RecruitmentSelectionRepository,
  SelectionInput,
  SelectionListItem,
  SelectionQuery,
} from "../types";
import { containsText, pageBounds, searchTerms, sqlList, toCount, type Database } from "./db";

const OPEN_SELECTION_STATUSES: SelectionStatus[] = ["OPEN", "PAUSED"];

/* ------------------------------------------------------------------ */
/* Aziende                                                              */
/* ------------------------------------------------------------------ */

function toCompany(row: typeof companies.$inferSelect): Company {
  return row;
}

export class PostgresCompanyRepository implements CompanyRepository {
  constructor(private readonly db: Database) {}

  async list(query: CompanyQuery): Promise<Page<CompanyListItem>> {
    const { limit, offset } = pageBounds(query);
    const openCount = sql<number>`(
      SELECT count(*)::int FROM recruitment_selections s
      WHERE s.company_id = ${companies.id} AND s.status IN (${sqlList(OPEN_SELECTION_STATUSES)})
    )`;
    const totalCount = sql<number>`(SELECT count(*)::int FROM recruitment_selections s WHERE s.company_id = ${companies.id})`;

    const conditions: SQL[] = [];
    for (const term of searchTerms(query.text)) {
      const clause = or(
        containsText(companies.name, term),
        containsText(companies.city, term),
        containsText(companies.vatNumber, term),
        containsText(companies.sector, term),
      );
      if (clause) conditions.push(clause);
    }
    if (query.region) conditions.push(sql`lower(${companies.region}) = lower(${query.region})`);
    if (query.withOpenSelections) conditions.push(sql`${openCount} > 0`);

    const rows = await this.db
      .select({
        company: companies,
        openSelections: openCount,
        totalSelections: totalCount,
        total: sql<number>`count(*) OVER ()::int`,
      })
      .from(companies)
      .where(and(...conditions))
      .orderBy(asc(sql`lower(${companies.name})`))
      .limit(limit)
      .offset(offset);

    return {
      total: toCount(rows[0]?.total ?? 0),
      items: rows.map((row) => ({
        company: toCompany(row.company),
        openSelections: toCount(row.openSelections),
        totalSelections: toCount(row.totalSelections),
      })),
    };
  }

  async getById(id: EntityId): Promise<Company | null> {
    const [row] = await this.db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return row ? toCompany(row) : null;
  }

  async create(input: CompanyInput): Promise<Company> {
    const [row] = await this.db
      .insert(companies)
      .values({ ...normalizeCompany(input), source: "ADV_HR" })
      .returning();
    if (!row) throw new Error("Creazione azienda fallita");
    return toCompany(row);
  }

  async update(id: EntityId, input: CompanyInput): Promise<Company | null> {
    const [row] = await this.db.update(companies).set(normalizeCompany(input)).where(eq(companies.id, id)).returning();
    return row ? toCompany(row) : null;
  }

  async options() {
    return this.db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .orderBy(asc(sql`lower(${companies.name})`));
  }
}

function normalizeCompany(input: CompanyInput): CompanyInput {
  return {
    ...input,
    name: input.name.trim(),
    vatNumber: input.vatNumber?.trim() || null,
    fiscalCode: input.fiscalCode?.trim().toUpperCase() || null,
    province: input.province?.trim().toUpperCase() || null,
    email: input.email?.trim().toLowerCase() || null,
  };
}

/* ------------------------------------------------------------------ */
/* Selezioni                                                            */
/* ------------------------------------------------------------------ */

const latestEvaluationOf = (applicationId: SQL) => sql`(
  SELECT e.result FROM application_evaluations e
  WHERE e.application_id = ${applicationId} ORDER BY e.evaluated_at DESC LIMIT 1
)`;

function selectionStatsColumns() {
  const perApplication = (condition: SQL) => sql<number>`(
    SELECT count(*)::int FROM applications a
    WHERE a.selection_id = ${recruitmentSelections.id} AND ${condition}
  )`;
  return {
    applicationsCount: perApplication(sql`true`),
    suitable: perApplication(sql`${latestEvaluationOf(sql`a.id`)} = 'SUITABLE'`),
    notSuitable: perApplication(sql`${latestEvaluationOf(sql`a.id`)} = 'NOT_SUITABLE'`),
    toEvaluate: perApplication(sql`coalesce(${latestEvaluationOf(sql`a.id`)}::text, 'TO_REVIEW') = 'TO_REVIEW'`),
    scheduledInterviews: sql<number>`(
      SELECT count(*)::int FROM interviews i JOIN applications a ON a.id = i.application_id
      WHERE a.selection_id = ${recruitmentSelections.id} AND i.status = 'SCHEDULED' AND i.scheduled_at >= now()
    )`,
  };
}

type SelectionRow = typeof recruitmentSelections.$inferSelect;

function toSelection(row: SelectionRow): RecruitmentSelection {
  return row;
}

export class PostgresSelectionRepository implements RecruitmentSelectionRepository {
  constructor(private readonly db: Database) {}

  private baseQuery() {
    return this.db
      .select({
        selection: recruitmentSelections,
        companyName: companies.name,
        ...selectionStatsColumns(),
        total: sql<number>`count(*) OVER ()::int`,
      })
      .from(recruitmentSelections)
      .innerJoin(companies, eq(companies.id, recruitmentSelections.companyId));
  }

  private toListItem(row: Awaited<ReturnType<PostgresSelectionRepository["baseQuery"]>>[number]): SelectionListItem {
    return {
      selection: toSelection(row.selection),
      companyName: row.companyName,
      stats: {
        applications: toCount(row.applicationsCount),
        suitable: toCount(row.suitable),
        notSuitable: toCount(row.notSuitable),
        toEvaluate: toCount(row.toEvaluate),
        scheduledInterviews: toCount(row.scheduledInterviews),
      },
    };
  }

  async list(query: SelectionQuery): Promise<Page<SelectionListItem>> {
    const { limit, offset } = pageBounds(query);
    const conditions: SQL[] = [];
    if (query.companyId) conditions.push(eq(recruitmentSelections.companyId, query.companyId));
    if (query.statuses?.length) conditions.push(inArray(recruitmentSelections.status, query.statuses));
    for (const term of searchTerms(query.text)) {
      const clause = or(containsText(recruitmentSelections.title, term), containsText(companies.name, term));
      if (clause) conditions.push(clause);
    }

    const rows = await this.baseQuery()
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${recruitmentSelections.status} WHEN 'OPEN' THEN 0 WHEN 'PAUSED' THEN 1 WHEN 'DRAFT' THEN 2 ELSE 3 END`,
        desc(recruitmentSelections.updatedAt),
      )
      .limit(limit)
      .offset(offset);

    return { total: toCount(rows[0]?.total ?? 0), items: rows.map((row) => this.toListItem(row)) };
  }

  async getById(id: EntityId): Promise<SelectionListItem | null> {
    const [row] = await this.baseQuery().where(eq(recruitmentSelections.id, id)).limit(1);
    return row ? this.toListItem(row) : null;
  }

  async create(input: SelectionInput & { createdBy: EntityId }): Promise<RecruitmentSelection> {
    const [row] = await this.db.insert(recruitmentSelections).values(input).returning();
    if (!row) throw new Error("Creazione selezione fallita");
    return toSelection(row);
  }

  async update(id: EntityId, input: SelectionInput): Promise<RecruitmentSelection | null> {
    const [row] = await this.db
      .update(recruitmentSelections)
      .set(input)
      .where(eq(recruitmentSelections.id, id))
      .returning();
    return row ? toSelection(row) : null;
  }

  async options(filter?: { statuses?: SelectionStatus[] }) {
    return this.db
      .select({ id: recruitmentSelections.id, title: recruitmentSelections.title, companyName: companies.name })
      .from(recruitmentSelections)
      .innerJoin(companies, eq(companies.id, recruitmentSelections.companyId))
      .where(filter?.statuses?.length ? inArray(recruitmentSelections.status, filter.statuses) : undefined)
      .orderBy(asc(companies.name), asc(recruitmentSelections.title));
  }
}

/* ------------------------------------------------------------------ */
/* Job description                                                      */
/* ------------------------------------------------------------------ */

export class PostgresJobDescriptionRepository implements JobDescriptionRepository {
  constructor(private readonly db: Database) {}

  async getBySelection(selectionId: EntityId): Promise<JobDescription | null> {
    const [row] = await this.db
      .select()
      .from(jobDescriptions)
      .where(eq(jobDescriptions.selectionId, selectionId))
      .limit(1);
    return row ?? null;
  }

  async upsert(selectionId: EntityId, input: JobDescriptionInput): Promise<JobDescription> {
    const [row] = await this.db
      .insert(jobDescriptions)
      .values({ selectionId, ...input })
      .onConflictDoUpdate({ target: jobDescriptions.selectionId, set: { ...input, updatedAt: new Date() } })
      .returning();
    if (!row) throw new Error("Salvataggio job description fallito");
    return row;
  }
}

/* ------------------------------------------------------------------ */
/* Stage                                                                */
/* ------------------------------------------------------------------ */

export class PostgresStageRepository implements RecruitingStageRepository {
  constructor(private readonly db: Database) {}

  async list(options?: { includeInactive?: boolean }): Promise<RecruitingStage[]> {
    return this.db
      .select()
      .from(recruitingStages)
      .where(options?.includeInactive ? undefined : eq(recruitingStages.active, true))
      .orderBy(asc(recruitingStages.position));
  }

  async getById(id: EntityId): Promise<RecruitingStage | null> {
    const [row] = await this.db.select().from(recruitingStages).where(eq(recruitingStages.id, id)).limit(1);
    return row ?? null;
  }

  async getByCode(code: string): Promise<RecruitingStage | null> {
    const [row] = await this.db.select().from(recruitingStages).where(eq(recruitingStages.code, code)).limit(1);
    return row ?? null;
  }
}

/* ------------------------------------------------------------------ */
/* Candidature                                                          */
/* ------------------------------------------------------------------ */

export class PostgresApplicationRepository implements ApplicationRepository {
  constructor(private readonly db: Database) {}

  private viewQuery() {
    return this.db
      .select({
        application: applications,
        candidate: candidates,
        city: candidateProfiles.residenceCity,
        selection: recruitmentSelections,
        companyId: companies.id,
        companyName: companies.name,
        stage: recruitingStages,
        recruiterName: users.displayName,
        nextInterviewAt: sql`(
          SELECT min(i.scheduled_at) FROM interviews i
          WHERE i.application_id = ${applications.id} AND i.status = 'SCHEDULED' AND i.scheduled_at >= now()
        )`.mapWith(interviews.scheduledAt),
        lastContactAt: sql`(
          SELECT max(ac.created_at) FROM activities ac
          WHERE ac.candidate_id = ${applications.candidateId}
            AND ac.action IN (${sqlList(CONTACT_ACTIONS)})
        )`.mapWith(activities.createdAt),
        // Mansione: settore di esperienza ADV CORE, altrimenti l'ultimo ruolo registrato.
        occupation: sql<string | null>`coalesce(
          (SELECT nullif(trim(r.payload->>'settore_esperienza'), '') FROM legacy_mappings lm
             JOIN adv_core_records r ON r.entity_type = lm.entity_type AND r.legacy_id = lm.legacy_id
             WHERE lm.legacy_system = 'ADV_CORE' AND lm.entity_type = 'CANDIDATE'
               AND lm.adv_hr_id = ${applications.candidateId} LIMIT 1),
          (SELECT e.role_title FROM candidate_experiences e WHERE e.candidate_id = ${applications.candidateId}
             ORDER BY e.end_date DESC NULLS FIRST, e.start_date DESC NULLS LAST LIMIT 1)
        )`,
        // Anni dichiarati in ADV CORE (valori non plausibili scartati), altrimenti dalle esperienze.
        experienceYears: sql<string | null>`coalesce(
          (SELECT CASE WHEN r.payload->>'esperienza_anni' ~ '^[0-9]{1,2}$' AND (r.payload->>'esperienza_anni')::int <= 50
                  THEN (r.payload->>'esperienza_anni')::int
                    + CASE WHEN r.payload->>'esperienza_mesi' ~ '^[0-9]{1,2}$' AND (r.payload->>'esperienza_mesi')::int <= 11
                           THEN (r.payload->>'esperienza_mesi')::numeric / 12 ELSE 0 END END
             FROM legacy_mappings lm
             JOIN adv_core_records r ON r.entity_type = lm.entity_type AND r.legacy_id = lm.legacy_id
             WHERE lm.legacy_system = 'ADV_CORE' AND lm.entity_type = 'CANDIDATE'
               AND lm.adv_hr_id = ${applications.candidateId} LIMIT 1),
          (SELECT nullif(sum(extract(year FROM age(coalesce(e.end_date, current_date), e.start_date)) * 12
                             + extract(month FROM age(coalesce(e.end_date, current_date), e.start_date))), 0) / 12
             FROM candidate_experiences e WHERE e.candidate_id = ${applications.candidateId})
        )`,
        relatedEvaluations: sql<number>`(SELECT count(*)::int FROM application_evaluations x WHERE x.application_id = ${applications.id})`,
        relatedFeedbacks: sql<number>`(SELECT count(*)::int FROM feedbacks x WHERE x.application_id = ${applications.id})`,
        relatedInterviews: sql<number>`(SELECT count(*)::int FROM interviews x WHERE x.application_id = ${applications.id})`,
        relatedScheduled: sql<number>`(SELECT count(*)::int FROM interviews x
          WHERE x.application_id = ${applications.id} AND x.status = 'SCHEDULED')`,
        relatedDocuments: sql<number>`(SELECT count(*)::int FROM documents x WHERE x.application_id = ${applications.id})`,
      })
      .from(applications)
      .innerJoin(candidates, eq(candidates.id, applications.candidateId))
      .leftJoin(candidateProfiles, eq(candidateProfiles.candidateId, candidates.id))
      .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, applications.selectionId))
      .innerJoin(companies, eq(companies.id, recruitmentSelections.companyId))
      .innerJoin(recruitingStages, eq(recruitingStages.id, applications.stageId))
      .leftJoin(users, eq(users.id, applications.recruiterId));
  }

  private async enrich(
    rows: Awaited<ReturnType<PostgresApplicationRepository["viewQuery"]>>,
  ): Promise<ApplicationView[]> {
    const ids = rows.map((row) => row.application.id);
    if (ids.length === 0) return [];

    const [evaluationRows, feedbackRows] = await Promise.all([
      this.db
        .selectDistinctOn([applicationEvaluations.applicationId], {
          applicationId: applicationEvaluations.applicationId,
          result: applicationEvaluations.result,
          reason: applicationEvaluations.reason,
          evaluatedAt: applicationEvaluations.evaluatedAt,
        })
        .from(applicationEvaluations)
        .where(inArray(applicationEvaluations.applicationId, ids))
        .orderBy(applicationEvaluations.applicationId, desc(applicationEvaluations.evaluatedAt)),
      this.db
        .selectDistinctOn([feedbacks.applicationId], {
          applicationId: feedbacks.applicationId,
          content: feedbacks.content,
          createdAt: feedbacks.createdAt,
          author: users.displayName,
        })
        .from(feedbacks)
        .innerJoin(users, eq(users.id, feedbacks.authorId))
        .where(inArray(feedbacks.applicationId, ids))
        .orderBy(feedbacks.applicationId, desc(feedbacks.createdAt)),
    ]);
    const evaluations = new Map(evaluationRows.map((row) => [row.applicationId, row]));
    const latestFeedbacks = new Map(feedbackRows.map((row) => [row.applicationId, row]));

    return rows.map((row) => {
      const evaluation = evaluations.get(row.application.id);
      const feedback = latestFeedbacks.get(row.application.id);
      return {
        application: row.application,
        candidate: {
          id: row.candidate.id,
          fullName: getCandidateFullName(row.candidate),
          city: row.city,
          occupation: row.occupation?.trim().slice(0, 120) || null,
          experienceYears: row.experienceYears === null ? null : Math.round(Number(row.experienceYears) * 10) / 10,
        },
        selection: { id: row.selection.id, title: row.selection.title, status: row.selection.status },
        company: { id: row.companyId, name: row.companyName },
        stage: row.stage,
        recruiter:
          row.application.recruiterId && row.recruiterName
            ? { id: row.application.recruiterId, displayName: row.recruiterName }
            : null,
        latestEvaluation: evaluation
          ? { result: evaluation.result, reason: evaluation.reason, evaluatedAt: evaluation.evaluatedAt }
          : null,
        latestFeedback: feedback
          ? { content: feedback.content, createdAt: feedback.createdAt, author: feedback.author }
          : null,
        nextInterviewAt: row.nextInterviewAt ?? null,
        lastContactAt: row.lastContactAt ?? null,
        related: {
          evaluations: Number(row.relatedEvaluations),
          feedbacks: Number(row.relatedFeedbacks),
          interviews: Number(row.relatedInterviews),
          scheduledInterviews: Number(row.relatedScheduled),
          documents: Number(row.relatedDocuments),
        },
      };
    });
  }

  async list(query: ApplicationQuery): Promise<ApplicationView[]> {
    const conditions: SQL[] = [];
    if (query.candidateId) conditions.push(eq(applications.candidateId, query.candidateId));
    if (query.selectionId) conditions.push(eq(applications.selectionId, query.selectionId));
    if (query.stageCodes?.length) conditions.push(inArray(recruitingStages.code, query.stageCodes));
    if (query.evaluation) {
      conditions.push(
        query.evaluation === "NONE"
          ? sql`${latestEvaluationOf(sql`${applications.id}`)} IS NULL`
          : sql`${latestEvaluationOf(sql`${applications.id}`)} = ${query.evaluation}`,
      );
    }
    const rows = await this.viewQuery()
      .where(and(...conditions))
      .orderBy(asc(recruitingStages.position), desc(applications.updatedAt));
    return this.enrich(rows);
  }

  async getById(id: EntityId): Promise<Application | null> {
    const [row] = await this.db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return row ?? null;
  }

  async getView(id: EntityId): Promise<ApplicationView | null> {
    const rows = await this.viewQuery().where(eq(applications.id, id)).limit(1);
    const [view] = await this.enrich(rows);
    return view ?? null;
  }

  async exists(candidateId: EntityId, selectionId: EntityId): Promise<boolean> {
    const [row] = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.candidateId, candidateId), eq(applications.selectionId, selectionId)))
      .limit(1);
    return Boolean(row);
  }

  async create(input: Parameters<ApplicationRepository["create"]>[0]): Promise<Application> {
    const [row] = await this.db.insert(applications).values(input).returning();
    if (!row) throw new Error("Creazione candidatura fallita");
    return row;
  }

  async updateStage(id: EntityId, stageId: EntityId, closedAt: Date | null): Promise<Application> {
    const [row] = await this.db
      .update(applications)
      .set({ stageId, closedAt })
      .where(eq(applications.id, id))
      .returning();
    if (!row) throw new Error("Candidatura non trovata");
    return row;
  }

  async assignRecruiter(id: EntityId, recruiterId: EntityId | null): Promise<Application> {
    const [row] = await this.db.update(applications).set({ recruiterId }).where(eq(applications.id, id)).returning();
    if (!row) throw new Error("Candidatura non trovata");
    return row;
  }

  async touch(id: EntityId): Promise<void> {
    await this.db.update(applications).set({ updatedAt: new Date() }).where(eq(applications.id, id));
  }

  async delete(id: EntityId): Promise<boolean> {
    const rows = await this.db.delete(applications).where(eq(applications.id, id)).returning({ id: applications.id });
    return rows.length > 0;
  }

  async addEvaluation(input: Parameters<ApplicationRepository["addEvaluation"]>[0]): Promise<ApplicationEvaluation> {
    const [row] = await this.db.insert(applicationEvaluations).values(input).returning();
    if (!row) throw new Error("Salvataggio valutazione fallito");
    const [author] = await this.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, row.evaluatedBy))
      .limit(1);
    return {
      id: row.id,
      applicationId: row.applicationId,
      result: row.result,
      reason: row.reason,
      notes: row.notes,
      evaluatedBy: { id: row.evaluatedBy, displayName: author?.displayName ?? "—" },
      evaluatedAt: row.evaluatedAt,
    };
  }

  async listEvaluations(applicationId: EntityId): Promise<ApplicationEvaluation[]> {
    const rows = await this.db
      .select({ evaluation: applicationEvaluations, authorName: users.displayName })
      .from(applicationEvaluations)
      .innerJoin(users, eq(users.id, applicationEvaluations.evaluatedBy))
      .where(eq(applicationEvaluations.applicationId, applicationId))
      .orderBy(desc(applicationEvaluations.evaluatedAt));
    return rows.map(({ evaluation, authorName }) => ({
      id: evaluation.id,
      applicationId: evaluation.applicationId,
      result: evaluation.result,
      reason: evaluation.reason,
      notes: evaluation.notes,
      evaluatedBy: { id: evaluation.evaluatedBy, displayName: authorName },
      evaluatedAt: evaluation.evaluatedAt,
    }));
  }
}
