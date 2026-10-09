import { aliasedTable, and, asc, desc, eq, gte, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm";

import {
  activities,
  applications,
  auditLogs,
  candidateProfiles,
  candidates,
  companies,
  documents,
  feedbacks,
  interviews,
  recruitmentSelections,
  talentPoolCandidates,
  talentPools,
  tasks,
  users,
} from "@/db/schema";
import {
  CONTACT_ACTIONS,
  getCandidateFullName,
  type Activity,
  type DocumentMetadata,
  type DocumentProcessingStatus,
  type EntityId,
  type Feedback,
  type Interview,
  type NewActivity,
  type NewAuditLog,
  type Page,
  type Task,
  type TalentPool,
  type TalentPoolMember,
} from "@/domain";

import type {
  ActivityQuery,
  ActivityRepository,
  AuditLogRepository,
  DocumentOwner,
  DocumentRepository,
  FeedbackRepository,
  FeedbackView,
  InterviewInput,
  InterviewQuery,
  InterviewRepository,
  InterviewView,
  TalentPoolRepository,
  TaskInput,
  TaskQuery,
  TaskRepository,
  TaskView,
} from "../types";
import { pageBounds, toCount, type Database } from "./db";

/* ------------------------------------------------------------------ */
/* Colloqui                                                             */
/* ------------------------------------------------------------------ */

function interviewConditions(query: Omit<InterviewQuery, "limit" | "offset" | "order">): SQL | undefined {
  const conditions: SQL[] = [];
  if (query.from) conditions.push(gte(interviews.scheduledAt, query.from));
  if (query.to) conditions.push(lte(interviews.scheduledAt, query.to));
  if (query.statuses?.length) conditions.push(inArray(interviews.status, query.statuses));
  if (query.recruiterId) conditions.push(eq(interviews.recruiterId, query.recruiterId));
  if (query.companyId) conditions.push(eq(recruitmentSelections.companyId, query.companyId));
  if (query.candidateId) conditions.push(eq(applications.candidateId, query.candidateId));
  if (query.applicationId) conditions.push(eq(interviews.applicationId, query.applicationId));
  if (query.selectionId) conditions.push(eq(applications.selectionId, query.selectionId));
  return and(...conditions);
}

export class PostgresInterviewRepository implements InterviewRepository {
  constructor(private readonly db: Database) {}

  private viewQuery() {
    return this.db
      .select({
        interview: interviews,
        candidate: candidates,
        selectionId: recruitmentSelections.id,
        selectionTitle: recruitmentSelections.title,
        companyId: companies.id,
        companyName: companies.name,
        recruiterName: users.displayName,
        total: sql<number>`count(*) OVER ()::int`,
      })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .innerJoin(candidates, eq(candidates.id, applications.candidateId))
      .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, applications.selectionId))
      .innerJoin(companies, eq(companies.id, recruitmentSelections.companyId))
      .leftJoin(users, eq(users.id, interviews.recruiterId));
  }

  private toView(row: Awaited<ReturnType<PostgresInterviewRepository["viewQuery"]>>[number]): InterviewView {
    return {
      interview: row.interview,
      candidate: { id: row.candidate.id, fullName: getCandidateFullName(row.candidate) },
      selection: { id: row.selectionId, title: row.selectionTitle },
      company: { id: row.companyId, name: row.companyName },
      recruiter:
        row.interview.recruiterId && row.recruiterName
          ? { id: row.interview.recruiterId, displayName: row.recruiterName }
          : null,
    };
  }

  async list(query: InterviewQuery): Promise<Page<InterviewView>> {
    const { limit, offset } = pageBounds(query);
    const rows = await this.viewQuery()
      .where(interviewConditions(query))
      .orderBy(query.order === "desc" ? desc(interviews.scheduledAt) : asc(interviews.scheduledAt))
      .limit(limit)
      .offset(offset);
    return { total: toCount(rows[0]?.total ?? 0), items: rows.map((row) => this.toView(row)) };
  }

  async getView(id: EntityId): Promise<InterviewView | null> {
    const [row] = await this.viewQuery().where(eq(interviews.id, id)).limit(1);
    return row ? this.toView(row) : null;
  }

  async getById(id: EntityId): Promise<Interview | null> {
    const [row] = await this.db.select().from(interviews).where(eq(interviews.id, id)).limit(1);
    return row ?? null;
  }

  async create(applicationId: EntityId, input: InterviewInput): Promise<Interview> {
    const [row] = await this.db
      .insert(interviews)
      .values({ applicationId, ...input })
      .returning();
    if (!row) throw new Error("Creazione colloquio fallita");
    return row;
  }

  async update(id: EntityId, input: InterviewInput): Promise<Interview | null> {
    const [row] = await this.db.update(interviews).set(input).where(eq(interviews.id, id)).returning();
    return row ?? null;
  }

  async count(query: Omit<InterviewQuery, "limit" | "offset" | "order">): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .innerJoin(applications, eq(applications.id, interviews.applicationId))
      .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, applications.selectionId))
      .where(interviewConditions(query));
    return toCount(row?.count);
  }
}

/* ------------------------------------------------------------------ */
/* Feedback                                                             */
/* ------------------------------------------------------------------ */

export class PostgresFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: Database) {}

  async create(input: Parameters<FeedbackRepository["create"]>[0]): Promise<Feedback> {
    const [row] = await this.db.insert(feedbacks).values(input).returning();
    if (!row) throw new Error("Salvataggio feedback fallito");
    const [author] = await this.db.select({ name: users.displayName }).from(users).where(eq(users.id, row.authorId));
    const { authorId, ...rest } = row;
    return { ...rest, author: { id: authorId, displayName: author?.name ?? "—" } };
  }

  async list(query: {
    applicationId?: EntityId;
    candidateId?: EntityId;
    interviewId?: EntityId;
  }): Promise<FeedbackView[]> {
    const conditions: SQL[] = [];
    if (query.applicationId) conditions.push(eq(feedbacks.applicationId, query.applicationId));
    if (query.candidateId) conditions.push(eq(applications.candidateId, query.candidateId));
    if (query.interviewId) conditions.push(eq(feedbacks.interviewId, query.interviewId));

    const rows = await this.db
      .select({
        feedback: feedbacks,
        authorName: users.displayName,
        selectionTitle: recruitmentSelections.title,
        candidateId: applications.candidateId,
      })
      .from(feedbacks)
      .innerJoin(users, eq(users.id, feedbacks.authorId))
      .innerJoin(applications, eq(applications.id, feedbacks.applicationId))
      .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, applications.selectionId))
      .where(and(...conditions))
      .orderBy(desc(feedbacks.createdAt));

    return rows.map(({ feedback: { authorId, ...feedback }, authorName, selectionTitle, candidateId }) => ({
      ...feedback,
      author: { id: authorId, displayName: authorName },
      selectionTitle,
      candidateId,
    }));
  }
}

/* ------------------------------------------------------------------ */
/* Activity e audit                                                     */
/* ------------------------------------------------------------------ */

export class PostgresActivityRepository implements ActivityRepository {
  constructor(private readonly db: Database) {}

  async record(activity: NewActivity): Promise<Activity> {
    const [row] = await this.db
      .insert(activities)
      .values({
        entityType: activity.entityType,
        entityId: activity.entityId,
        action: activity.action,
        actorId: activity.actorId,
        candidateId: activity.candidateId ?? null,
        selectionId: activity.selectionId ?? null,
        companyId: activity.companyId ?? null,
        metadata: activity.metadata,
      })
      .returning();
    if (!row) throw new Error("Registrazione attività fallita");
    const { actorId, ...rest } = row;
    return { ...rest, actor: actorId ? { id: actorId, displayName: "" } : null };
  }

  async list(query: ActivityQuery): Promise<Activity[]> {
    const { limit, offset } = pageBounds({ limit: query.limit ?? 50, offset: query.offset });
    const conditions: SQL[] = [];
    if (query.candidateId) conditions.push(eq(activities.candidateId, query.candidateId));
    if (query.selectionId) conditions.push(eq(activities.selectionId, query.selectionId));
    if (query.companyId) conditions.push(eq(activities.companyId, query.companyId));
    if (query.entity) {
      conditions.push(and(eq(activities.entityType, query.entity.type), eq(activities.entityId, query.entity.id))!);
    }

    const rows = await this.db
      .select({ activity: activities, actorName: users.displayName })
      .from(activities)
      .leftJoin(users, eq(users.id, activities.actorId))
      .where(conditions.length > 1 ? or(...conditions) : conditions[0])
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(({ activity: { actorId, ...activity }, actorName }) => ({
      ...activity,
      actor: actorId && actorName ? { id: actorId, displayName: actorName } : null,
    }));
  }

  async lastContactAt(candidateId: EntityId): Promise<Date | null> {
    const [row] = await this.db
      .select({ createdAt: activities.createdAt })
      .from(activities)
      .where(and(eq(activities.candidateId, candidateId), inArray(activities.action, [...CONTACT_ACTIONS])))
      .orderBy(desc(activities.createdAt))
      .limit(1);
    return row?.createdAt ?? null;
  }
}

export class PostgresAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Database) {}

  async record(entry: NewAuditLog): Promise<void> {
    await this.db.insert(auditLogs).values(entry);
  }

  async list(entity: { type: string; id: EntityId }) {
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entity.type), eq(auditLogs.entityId, entity.id)))
      .orderBy(desc(auditLogs.createdAt));
    return rows.map((row) => ({ ...row, entityType: row.entityType as NewAuditLog["entityType"] }));
  }
}

/* ------------------------------------------------------------------ */
/* Task                                                                 */
/* ------------------------------------------------------------------ */

const assignee = aliasedTable(users, "assignee");

function taskConditions(query: Omit<TaskQuery, "limit" | "offset">): SQL | undefined {
  const conditions: SQL[] = [];
  if (query.assignedTo) conditions.push(eq(tasks.assignedTo, query.assignedTo));
  if (query.statuses?.length) conditions.push(inArray(tasks.status, query.statuses));
  if (query.candidateId) conditions.push(eq(tasks.candidateId, query.candidateId));
  if (query.selectionId) conditions.push(eq(tasks.selectionId, query.selectionId));
  if (query.applicationId) conditions.push(eq(tasks.applicationId, query.applicationId));
  if (query.overdueAt) conditions.push(lt(tasks.dueAt, query.overdueAt));
  return and(...conditions);
}

export class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly db: Database) {}

  async list(query: TaskQuery): Promise<Page<TaskView>> {
    const { limit, offset } = pageBounds(query);
    const rows = await this.db
      .select({
        task: tasks,
        assigneeName: assignee.displayName,
        candidate: candidates,
        selectionTitle: recruitmentSelections.title,
        total: sql<number>`count(*) OVER ()::int`,
      })
      .from(tasks)
      .innerJoin(assignee, eq(assignee.id, tasks.assignedTo))
      .leftJoin(candidates, eq(candidates.id, tasks.candidateId))
      .leftJoin(recruitmentSelections, eq(recruitmentSelections.id, tasks.selectionId))
      .where(taskConditions(query))
      .orderBy(
        sql`CASE WHEN ${tasks.status} IN ('OPEN', 'IN_PROGRESS') THEN 0 ELSE 1 END`,
        sql`${tasks.dueAt} ASC NULLS LAST`,
        sql`CASE ${tasks.priority} WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END`,
        desc(tasks.createdAt),
      )
      .limit(limit)
      .offset(offset);

    return {
      total: toCount(rows[0]?.total ?? 0),
      items: rows.map(({ task: { assignedTo, ...task }, assigneeName, candidate, selectionTitle }) => ({
        ...task,
        assignedTo: { id: assignedTo, displayName: assigneeName },
        candidateName: candidate ? getCandidateFullName(candidate) : null,
        selectionTitle,
      })),
    };
  }

  async getById(id: EntityId): Promise<Task | null> {
    const [row] = await this.db
      .select({ task: tasks, assigneeName: users.displayName })
      .from(tasks)
      .innerJoin(users, eq(users.id, tasks.assignedTo))
      .where(eq(tasks.id, id))
      .limit(1);
    if (!row) return null;
    const { assignedTo, ...task } = row.task;
    return { ...task, assignedTo: { id: assignedTo, displayName: row.assigneeName } };
  }

  async create(input: TaskInput & { createdBy: EntityId }): Promise<Task> {
    const [row] = await this.db.insert(tasks).values(input).returning();
    if (!row) throw new Error("Creazione task fallita");
    const task = await this.getById(row.id);
    if (!task) throw new Error("Creazione task fallita");
    return task;
  }

  async updateStatus(id: EntityId, status: Task["status"], completedAt: Date | null): Promise<Task | null> {
    const [row] = await this.db.update(tasks).set({ status, completedAt }).where(eq(tasks.id, id)).returning();
    return row ? this.getById(row.id) : null;
  }

  async count(query: Omit<TaskQuery, "limit" | "offset">): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(taskConditions(query));
    return toCount(row?.count);
  }
}

/* ------------------------------------------------------------------ */
/* Documenti                                                            */
/* ------------------------------------------------------------------ */

function toDocument(row: typeof documents.$inferSelect, uploaderName: string | null): DocumentMetadata {
  const { uploadedBy, ...rest } = row;
  return { ...rest, uploadedBy: uploadedBy ? { id: uploadedBy, displayName: uploaderName ?? "—" } : null };
}

export class PostgresDocumentRepository implements DocumentRepository {
  constructor(private readonly db: Database) {}

  async list(owner: DocumentOwner): Promise<DocumentMetadata[]> {
    const conditions: SQL[] = [];
    if (owner.candidateId) conditions.push(eq(documents.candidateId, owner.candidateId));
    if (owner.applicationId) conditions.push(eq(documents.applicationId, owner.applicationId));
    if (owner.companyId) conditions.push(eq(documents.companyId, owner.companyId));
    if (owner.selectionId) conditions.push(eq(documents.selectionId, owner.selectionId));
    if (conditions.length === 0) return [];

    const rows = await this.db
      .select({ document: documents, uploaderName: users.displayName })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.uploadedBy))
      .where(or(...conditions))
      .orderBy(desc(documents.createdAt));
    return rows.map((row) => toDocument(row.document, row.uploaderName));
  }

  async getById(id: EntityId): Promise<DocumentMetadata | null> {
    const [row] = await this.db
      .select({ document: documents, uploaderName: users.displayName })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.uploadedBy))
      .where(eq(documents.id, id))
      .limit(1);
    return row ? toDocument(row.document, row.uploaderName) : null;
  }

  async create(input: Parameters<DocumentRepository["create"]>[0]): Promise<DocumentMetadata> {
    const [row] = await this.db
      .insert(documents)
      .values({
        candidateId: input.owner.candidateId ?? null,
        applicationId: input.owner.applicationId ?? null,
        companyId: input.owner.companyId ?? null,
        selectionId: input.owner.selectionId ?? null,
        type: input.type,
        filename: input.filename,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.uploadedBy,
      })
      .returning();
    if (!row) throw new Error("Registrazione documento fallita");
    return toDocument(row, null);
  }

  async updateProcessingStatus(id: EntityId, status: DocumentProcessingStatus): Promise<void> {
    await this.db.update(documents).set({ processingStatus: status }).where(eq(documents.id, id));
  }

  async delete(id: EntityId): Promise<boolean> {
    const rows = await this.db.delete(documents).where(eq(documents.id, id)).returning({ id: documents.id });
    return rows.length > 0;
  }
}

/* ------------------------------------------------------------------ */
/* Talent pool                                                          */
/* ------------------------------------------------------------------ */

export class PostgresTalentPoolRepository implements TalentPoolRepository {
  constructor(private readonly db: Database) {}

  private poolQuery() {
    return this.db
      .select({
        pool: talentPools,
        memberCount: sql<number>`(SELECT count(*)::int FROM talent_pool_candidates m WHERE m.talent_pool_id = ${talentPools.id})`,
      })
      .from(talentPools);
  }

  private toPool(row: Awaited<ReturnType<PostgresTalentPoolRepository["poolQuery"]>>[number]): TalentPool {
    return { ...row.pool, memberCount: toCount(row.memberCount) };
  }

  async list(): Promise<TalentPool[]> {
    const rows = await this.poolQuery().orderBy(asc(talentPools.name));
    return rows.map((row) => this.toPool(row));
  }

  async getById(id: EntityId): Promise<TalentPool | null> {
    const [row] = await this.poolQuery().where(eq(talentPools.id, id)).limit(1);
    return row ? this.toPool(row) : null;
  }

  async create(input: { name: string; description: string | null; createdBy: EntityId }): Promise<TalentPool> {
    const [row] = await this.db.insert(talentPools).values(input).returning();
    if (!row) throw new Error("Creazione talent pool fallita");
    return { ...row, memberCount: 0 };
  }

  async members(poolId: EntityId): Promise<TalentPoolMember[]> {
    const rows = await this.db
      .select({ candidate: candidates, city: candidateProfiles.residenceCity, addedAt: talentPoolCandidates.addedAt })
      .from(talentPoolCandidates)
      .innerJoin(candidates, eq(candidates.id, talentPoolCandidates.candidateId))
      .leftJoin(candidateProfiles, eq(candidateProfiles.candidateId, candidates.id))
      .where(eq(talentPoolCandidates.talentPoolId, poolId))
      .orderBy(asc(sql`lower(${candidates.lastName})`));
    return rows.map((row) => ({
      candidateId: row.candidate.id,
      fullName: getCandidateFullName(row.candidate),
      city: row.city,
      addedAt: row.addedAt,
    }));
  }

  async poolsOfCandidate(candidateId: EntityId) {
    return this.db
      .select({ id: talentPools.id, name: talentPools.name })
      .from(talentPoolCandidates)
      .innerJoin(talentPools, eq(talentPools.id, talentPoolCandidates.talentPoolId))
      .where(eq(talentPoolCandidates.candidateId, candidateId))
      .orderBy(asc(talentPools.name));
  }

  async addMember(poolId: EntityId, candidateId: EntityId, addedBy: EntityId): Promise<boolean> {
    const rows = await this.db
      .insert(talentPoolCandidates)
      .values({ talentPoolId: poolId, candidateId, addedBy })
      .onConflictDoNothing()
      .returning({ id: talentPoolCandidates.candidateId });
    return rows.length > 0;
  }

  async removeMember(poolId: EntityId, candidateId: EntityId): Promise<boolean> {
    const rows = await this.db
      .delete(talentPoolCandidates)
      .where(and(eq(talentPoolCandidates.talentPoolId, poolId), eq(talentPoolCandidates.candidateId, candidateId)))
      .returning({ id: talentPoolCandidates.candidateId });
    return rows.length > 0;
  }
}
