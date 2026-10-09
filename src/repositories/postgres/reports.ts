import { and, asc, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import {
  applicationEvaluations,
  applications,
  candidates,
  interviews,
  recruitingStages,
  recruitmentSelections,
} from "@/db/schema";

import type { ReportRepository } from "../types";
import { sqlList, toCount, type Database } from "./db";

type Range = { from: Date; to: Date };

function inRange(column: typeof applications.createdAt, range?: Range): SQL | undefined {
  return range ? and(gte(column, range.from), lte(column, range.to)) : undefined;
}

/** Stage della candidatura più recente di ogni candidato. */
const LATEST_STAGE_PER_CANDIDATE = sql`(
  SELECT DISTINCT ON (a.candidate_id) a.candidate_id, a.stage_id
  FROM applications a ORDER BY a.candidate_id, a.updated_at DESC
)`;

export class PostgresReportRepository implements ReportRepository {
  constructor(private readonly db: Database) {}

  async candidatesByStage() {
    const rows = await this.db
      .select({
        code: recruitingStages.code,
        label: recruitingStages.label,
        count: sql<number>`(
          SELECT count(*)::int FROM ${LATEST_STAGE_PER_CANDIDATE} latest WHERE latest.stage_id = ${recruitingStages.id}
        )`,
      })
      .from(recruitingStages)
      .orderBy(asc(recruitingStages.position));
    return rows.map((row) => ({ ...row, count: toCount(row.count) }));
  }

  async applicationsByStage(range?: Range) {
    const rows = await this.db
      .select({
        code: recruitingStages.code,
        label: recruitingStages.label,
        count: sql<number>`count(${applications.id})::int`,
      })
      .from(recruitingStages)
      .leftJoin(
        applications,
        and(sql`${applications.stageId} = ${recruitingStages.id}`, inRange(applications.createdAt, range)),
      )
      .groupBy(recruitingStages.id)
      .orderBy(asc(recruitingStages.position));
    return rows.map((row) => ({ ...row, count: toCount(row.count) }));
  }

  async applicationsBySource(range?: Range) {
    const rows = await this.db
      .select({ source: applications.source, count: sql<number>`count(*)::int` })
      .from(applications)
      .where(inRange(applications.createdAt, range))
      .groupBy(applications.source)
      .orderBy(sql`count(*) DESC`);
    return rows.map((row) => ({ ...row, count: toCount(row.count) }));
  }

  async selectionsByStatus() {
    const rows = await this.db
      .select({ status: recruitmentSelections.status, count: sql<number>`count(*)::int` })
      .from(recruitmentSelections)
      .groupBy(recruitmentSelections.status);
    return rows.map((row) => ({ ...row, count: toCount(row.count) }));
  }

  async interviewsByStatus(range: Range) {
    const rows = await this.db
      .select({ status: interviews.status, count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(and(gte(interviews.scheduledAt, range.from), lte(interviews.scheduledAt, range.to)))
      .groupBy(interviews.status);
    return rows.map((row) => ({ ...row, count: toCount(row.count) }));
  }

  async evaluationsByResult(range?: Range) {
    // Solo l'ultima valutazione di ogni candidatura.
    const rows = await this.db
      .select({ result: applicationEvaluations.result, count: sql<number>`count(*)::int` })
      .from(applicationEvaluations)
      .where(
        and(
          sql`${applicationEvaluations.evaluatedAt} = (
              SELECT max(e2.evaluated_at) FROM application_evaluations e2
              WHERE e2.application_id = ${applicationEvaluations.applicationId}
            )`,
          range
            ? and(
                gte(applicationEvaluations.evaluatedAt, range.from),
                lte(applicationEvaluations.evaluatedAt, range.to),
              )
            : undefined,
        ),
      )
      .groupBy(applicationEvaluations.result);
    return rows.map((row) => ({ ...row, count: toCount(row.count) }));
  }

  async countCandidates(filter?: { createdSince?: Date; activeOnly?: boolean; withoutFeedback?: boolean }) {
    const conditions: SQL[] = [];
    if (filter?.createdSince) conditions.push(gte(candidates.createdAt, filter.createdSince));
    if (filter?.activeOnly) {
      // Attivo = ha almeno una candidatura aperta in uno stage non terminale.
      conditions.push(sql`EXISTS (
        SELECT 1 FROM applications a JOIN recruiting_stages s ON s.id = a.stage_id
        WHERE a.candidate_id = ${candidates.id} AND a.closed_at IS NULL AND NOT s.is_terminal
      )`);
    }
    if (filter?.withoutFeedback) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM applications a JOIN recruiting_stages s ON s.id = a.stage_id
        WHERE a.candidate_id = ${candidates.id} AND a.closed_at IS NULL AND NOT s.is_terminal
          AND NOT EXISTS (SELECT 1 FROM feedbacks f WHERE f.application_id = a.id)
      )`);
    }
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(candidates)
      .where(and(...conditions));
    return toCount(row?.count);
  }

  async countApplications(filter: { stageCodes?: string[] }) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .innerJoin(recruitingStages, sql`${recruitingStages.id} = ${applications.stageId}`)
      .where(
        and(
          sql`${applications.closedAt} IS NULL`,
          filter.stageCodes?.length ? inArray(recruitingStages.code, filter.stageCodes) : undefined,
        ),
      );
    return toCount(row?.count);
  }

  async countSelections(filter: { statuses: string[] }) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(recruitmentSelections)
      .where(sql`${recruitmentSelections.status} IN (${sqlList(filter.statuses)})`);
    return toCount(row?.count);
  }
}
