import { aliasedTable, desc, eq } from "drizzle-orm";

import { jobRequests, users } from "@/db/schema";
import type { EntityId, JobRequest } from "@/domain";

import type { JobRequestCreateInput, JobRequestRepository, JobRequestUpdate } from "../types";
import type { Database } from "./db";

const approvers = aliasedTable(users, "approvers");

type JobRequestRow = typeof jobRequests.$inferSelect;

function toJobRequest(row: JobRequestRow, creatorName: string | null, approverName: string | null): JobRequest {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    revision: row.revision,
    status: row.status,
    form: row.form,
    validatedForm: row.validatedForm,
    signedDocumentId: row.signedDocumentId,
    selectionId: row.selectionId,
    reviewNote: row.reviewNote,
    recipientEmail: row.recipientEmail,
    accessExpiresAt: row.accessExpiresAt,
    sentAt: row.sentAt,
    submittedAt: row.submittedAt,
    createdBy: row.createdBy && creatorName ? { id: row.createdBy, displayName: creatorName } : null,
    approvedBy: row.approvedBy && approverName ? { id: row.approvedBy, displayName: approverName } : null,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PostgresJobRequestRepository implements JobRequestRepository {
  constructor(private readonly db: Database) {}

  private select() {
    return this.db
      .select({ request: jobRequests, creatorName: users.displayName, approverName: approvers.displayName })
      .from(jobRequests)
      .leftJoin(users, eq(users.id, jobRequests.createdBy))
      .leftJoin(approvers, eq(approvers.id, jobRequests.approvedBy));
  }

  async listByCompany(companyId: EntityId): Promise<JobRequest[]> {
    const rows = await this.select().where(eq(jobRequests.companyId, companyId)).orderBy(desc(jobRequests.createdAt));
    return rows.map((row) => toJobRequest(row.request, row.creatorName, row.approverName));
  }

  async getById(id: EntityId): Promise<JobRequest | null> {
    const [row] = await this.select().where(eq(jobRequests.id, id)).limit(1);
    return row ? toJobRequest(row.request, row.creatorName, row.approverName) : null;
  }

  async getByAccessTokenHash(hash: string): Promise<JobRequest | null> {
    const [row] = await this.select().where(eq(jobRequests.accessTokenHash, hash)).limit(1);
    return row ? toJobRequest(row.request, row.creatorName, row.approverName) : null;
  }

  async create(input: JobRequestCreateInput): Promise<JobRequest> {
    const [row] = await this.db
      .insert(jobRequests)
      .values({ companyId: input.companyId, code: input.code, form: input.form, createdBy: input.createdBy })
      .returning();
    if (!row) throw new Error("Registrazione richiesta fallita");
    return toJobRequest(row, null, null);
  }

  async update(id: EntityId, changes: JobRequestUpdate): Promise<void> {
    await this.db.update(jobRequests).set(changes).where(eq(jobRequests.id, id));
  }
}
