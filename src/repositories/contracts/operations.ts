import type {
  Activity,
  ActivityEntityType,
  DocumentMetadata,
  DocumentProcessingStatus,
  DocumentType,
  EntityId,
  Feedback,
  FeedbackType,
  Interview,
  InterviewStatus,
  InterviewType,
  NewActivity,
  NewAuditLog,
  Page,
  PageRequest,
  StorageProvider,
  Task,
  TaskPriority,
  TaskStatus,
  TalentPool,
  TalentPoolMember,
  UserRef,
} from "@/domain";

/* ------------------------------------------------------------------ */
/* Colloqui                                                             */
/* ------------------------------------------------------------------ */

export interface InterviewQuery extends PageRequest {
  from?: Date;
  to?: Date;
  statuses?: InterviewStatus[];
  recruiterId?: EntityId;
  companyId?: EntityId;
  candidateId?: EntityId;
  applicationId?: EntityId;
  selectionId?: EntityId;
  order?: "asc" | "desc";
}

export interface InterviewView {
  interview: Interview;
  candidate: { id: EntityId; fullName: string };
  selection: { id: EntityId; title: string };
  company: { id: EntityId; name: string };
  recruiter: UserRef | null;
}

export type InterviewInput = {
  recruiterId: EntityId | null;
  scheduledAt: Date;
  durationMinutes: number | null;
  type: InterviewType;
  status: InterviewStatus;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
};

export interface InterviewRepository {
  list(query: InterviewQuery): Promise<Page<InterviewView>>;
  getView(id: EntityId): Promise<InterviewView | null>;
  getById(id: EntityId): Promise<Interview | null>;
  create(applicationId: EntityId, input: InterviewInput): Promise<Interview>;
  update(id: EntityId, input: InterviewInput): Promise<Interview | null>;
  count(query: Omit<InterviewQuery, "limit" | "offset" | "order">): Promise<number>;
}

/* ------------------------------------------------------------------ */
/* Feedback                                                             */
/* ------------------------------------------------------------------ */

export interface FeedbackView extends Feedback {
  selectionTitle: string;
  candidateId: EntityId;
}

export interface FeedbackRepository {
  create(input: {
    applicationId: EntityId;
    interviewId: EntityId | null;
    authorId: EntityId;
    type: FeedbackType;
    content: string;
  }): Promise<Feedback>;
  list(query: { applicationId?: EntityId; candidateId?: EntityId; interviewId?: EntityId }): Promise<FeedbackView[]>;
}

/* ------------------------------------------------------------------ */
/* Activity e audit                                                     */
/* ------------------------------------------------------------------ */

export interface ActivityQuery extends PageRequest {
  candidateId?: EntityId;
  selectionId?: EntityId;
  companyId?: EntityId;
  entity?: { type: ActivityEntityType; id: EntityId };
}

export interface ActivityRepository {
  record(activity: NewActivity): Promise<Activity>;
  list(query: ActivityQuery): Promise<Activity[]>;
  /** Ultimo contatto derivato dalle activity di tipo contatto. */
  lastContactAt(candidateId: EntityId): Promise<Date | null>;
}

export interface AuditLogRepository {
  record(entry: NewAuditLog): Promise<void>;
  list(entity: { type: string; id: EntityId }): Promise<Array<NewAuditLog & { id: EntityId; createdAt: Date }>>;
}

/* ------------------------------------------------------------------ */
/* Task                                                                 */
/* ------------------------------------------------------------------ */

export interface TaskQuery extends PageRequest {
  assignedTo?: EntityId;
  statuses?: TaskStatus[];
  candidateId?: EntityId;
  selectionId?: EntityId;
  applicationId?: EntityId;
  overdueAt?: Date;
}

export interface TaskView extends Task {
  candidateName: string | null;
  selectionTitle: string | null;
}

export interface TaskInput {
  title: string;
  description: string | null;
  assignedTo: EntityId;
  candidateId: EntityId | null;
  applicationId: EntityId | null;
  selectionId: EntityId | null;
  dueAt: Date | null;
  priority: TaskPriority;
}

export interface TaskRepository {
  list(query: TaskQuery): Promise<Page<TaskView>>;
  getById(id: EntityId): Promise<Task | null>;
  create(input: TaskInput & { createdBy: EntityId }): Promise<Task>;
  updateStatus(id: EntityId, status: TaskStatus, completedAt: Date | null): Promise<Task | null>;
  count(query: Omit<TaskQuery, "limit" | "offset">): Promise<number>;
}

/* ------------------------------------------------------------------ */
/* Documenti                                                            */
/* ------------------------------------------------------------------ */

export interface DocumentOwner {
  candidateId?: EntityId;
  applicationId?: EntityId;
  companyId?: EntityId;
  selectionId?: EntityId;
}

export interface DocumentRepository {
  list(owner: DocumentOwner): Promise<DocumentMetadata[]>;
  getById(id: EntityId): Promise<DocumentMetadata | null>;
  create(input: {
    owner: DocumentOwner;
    type: DocumentType;
    filename: string;
    storageProvider: StorageProvider;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    /** null = caricato dall'azienda tramite link personale. */
    uploadedBy: EntityId | null;
  }): Promise<DocumentMetadata>;
  updateProcessingStatus(id: EntityId, status: DocumentProcessingStatus): Promise<void>;
  delete(id: EntityId): Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/* Talent pool                                                          */
/* ------------------------------------------------------------------ */

export interface TalentPoolRepository {
  list(): Promise<TalentPool[]>;
  getById(id: EntityId): Promise<TalentPool | null>;
  create(input: { name: string; description: string | null; createdBy: EntityId }): Promise<TalentPool>;
  members(poolId: EntityId): Promise<TalentPoolMember[]>;
  poolsOfCandidate(candidateId: EntityId): Promise<Array<{ id: EntityId; name: string }>>;
  addMember(poolId: EntityId, candidateId: EntityId, addedBy: EntityId): Promise<boolean>;
  removeMember(poolId: EntityId, candidateId: EntityId): Promise<boolean>;
}
