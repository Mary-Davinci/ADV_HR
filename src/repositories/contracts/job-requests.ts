import type { EntityId, JobRequest, JobRequestForm, JobRequestFormValues, JobRequestStatus } from "@/domain";

/* ------------------------------------------------------------------ */
/* Richieste di personale                                               */
/* ------------------------------------------------------------------ */

export interface JobRequestCreateInput {
  companyId: EntityId;
  code: string;
  form: JobRequestFormValues;
  createdBy: EntityId;
}

export interface JobRequestUpdate {
  status?: JobRequestStatus;
  revision?: number;
  form?: JobRequestFormValues;
  validatedForm?: JobRequestForm | null;
  signedDocumentId?: EntityId | null;
  selectionId?: EntityId | null;
  reviewNote?: string | null;
  approvedBy?: EntityId | null;
  approvedAt?: Date | null;
  recipientEmail?: string | null;
  accessTokenHash?: string | null;
  accessExpiresAt?: Date | null;
  sentAt?: Date | null;
  submittedAt?: Date | null;
}

export interface JobRequestRepository {
  listByCompany(companyId: EntityId): Promise<JobRequest[]>;
  getById(id: EntityId): Promise<JobRequest | null>;
  /** Richiesta collegata al link personale (hash SHA-256 del token). */
  getByAccessTokenHash(hash: string): Promise<JobRequest | null>;
  create(input: JobRequestCreateInput): Promise<JobRequest>;
  update(id: EntityId, changes: JobRequestUpdate): Promise<void>;
}
