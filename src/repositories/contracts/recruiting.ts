import type {
  Application,
  ApplicationEvaluation,
  ApplicationSource,
  Company,
  EntityId,
  EvaluationResult,
  JobDescription,
  Page,
  PageRequest,
  RecruitingStage,
  RecruitmentSelection,
  SelectionStatus,
  UserRef,
} from "@/domain";

/* ------------------------------------------------------------------ */
/* Aziende                                                              */
/* ------------------------------------------------------------------ */

export interface CompanyQuery extends PageRequest {
  text?: string;
  region?: string;
  withOpenSelections?: boolean;
}

export interface CompanyListItem {
  company: Company;
  openSelections: number;
  totalSelections: number;
}

export type CompanyInput = Omit<Company, "id" | "createdAt" | "updatedAt" | "source">;

export interface CompanyRepository {
  list(query: CompanyQuery): Promise<Page<CompanyListItem>>;
  getById(id: EntityId): Promise<Company | null>;
  create(input: CompanyInput): Promise<Company>;
  update(id: EntityId, input: CompanyInput): Promise<Company | null>;
  options(): Promise<Array<{ id: EntityId; name: string }>>;
}

/* ------------------------------------------------------------------ */
/* Selezioni                                                            */
/* ------------------------------------------------------------------ */

export interface SelectionQuery extends PageRequest {
  companyId?: EntityId;
  statuses?: SelectionStatus[];
  text?: string;
}

/** Contatori di sintesi della selezione, calcolati dal database. */
export interface SelectionStats {
  applications: number;
  suitable: number;
  notSuitable: number;
  toEvaluate: number;
  scheduledInterviews: number;
}

export interface SelectionListItem {
  selection: RecruitmentSelection;
  companyName: string;
  stats: SelectionStats;
}

export interface SelectionInput {
  companyId: EntityId;
  title: string;
  status: SelectionStatus;
  openedAt: Date | null;
  closedAt: Date | null;
}

export interface RecruitmentSelectionRepository {
  list(query: SelectionQuery): Promise<Page<SelectionListItem>>;
  getById(id: EntityId): Promise<SelectionListItem | null>;
  create(input: SelectionInput & { createdBy: EntityId }): Promise<RecruitmentSelection>;
  update(id: EntityId, input: SelectionInput): Promise<RecruitmentSelection | null>;
  options(filter?: {
    statuses?: SelectionStatus[];
  }): Promise<Array<{ id: EntityId; title: string; companyName: string }>>;
}

export type JobDescriptionInput = Omit<JobDescription, "id" | "selectionId" | "createdAt" | "updatedAt">;

export interface JobDescriptionRepository {
  getBySelection(selectionId: EntityId): Promise<JobDescription | null>;
  upsert(selectionId: EntityId, input: JobDescriptionInput): Promise<JobDescription>;
}

/* ------------------------------------------------------------------ */
/* Pipeline e candidature                                               */
/* ------------------------------------------------------------------ */

export interface RecruitingStageRepository {
  list(options?: { includeInactive?: boolean }): Promise<RecruitingStage[]>;
  getById(id: EntityId): Promise<RecruitingStage | null>;
  getByCode(code: string): Promise<RecruitingStage | null>;
}

/** Candidatura arricchita per le viste (pipeline, scheda candidato). */
export interface ApplicationView {
  application: Application;
  candidate: { id: EntityId; fullName: string; city: string | null };
  selection: { id: EntityId; title: string; status: SelectionStatus };
  company: { id: EntityId; name: string };
  stage: RecruitingStage;
  recruiter: UserRef | null;
  latestEvaluation: Pick<ApplicationEvaluation, "result" | "reason" | "evaluatedAt"> | null;
  latestFeedback: { content: string; createdAt: Date; author: string } | null;
  nextInterviewAt: Date | null;
  lastContactAt: Date | null;
}

export interface ApplicationQuery {
  candidateId?: EntityId;
  selectionId?: EntityId;
  stageCodes?: string[];
  evaluation?: EvaluationResult | "NONE";
}

export interface ApplicationRepository {
  list(query: ApplicationQuery): Promise<ApplicationView[]>;
  getById(id: EntityId): Promise<Application | null>;
  getView(id: EntityId): Promise<ApplicationView | null>;
  exists(candidateId: EntityId, selectionId: EntityId): Promise<boolean>;
  create(input: {
    candidateId: EntityId;
    selectionId: EntityId;
    stageId: EntityId;
    recruiterId: EntityId | null;
    source: ApplicationSource;
  }): Promise<Application>;
  updateStage(id: EntityId, stageId: EntityId, closedAt: Date | null): Promise<Application>;
  assignRecruiter(id: EntityId, recruiterId: EntityId | null): Promise<Application>;
  /** Tocca `updated_at` (es. dopo nuovo feedback o colloquio). */
  touch(id: EntityId): Promise<void>;

  addEvaluation(input: {
    applicationId: EntityId;
    result: EvaluationResult;
    reason: string | null;
    notes: string | null;
    evaluatedBy: EntityId;
  }): Promise<ApplicationEvaluation>;
  listEvaluations(applicationId: EntityId): Promise<ApplicationEvaluation[]>;
}
