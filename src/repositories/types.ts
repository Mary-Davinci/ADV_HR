import type { EntityId, RoleCode, User, UserRef, UserWithCredentials } from "@/domain";

import type { CandidateRepository, SkillRepository } from "./contracts/candidates";
import type {
  ActivityRepository,
  AuditLogRepository,
  DocumentRepository,
  FeedbackRepository,
  InterviewRepository,
  TalentPoolRepository,
  TaskRepository,
} from "./contracts/operations";
import type {
  ApplicationRepository,
  CompanyRepository,
  JobDescriptionRepository,
  RecruitingStageRepository,
  RecruitmentSelectionRepository,
} from "./contracts/recruiting";

export * from "./contracts/candidates";
export * from "./contracts/operations";
export * from "./contracts/recruiting";

/**
 * Contratti del data layer di ADV_HR.
 *
 * Pagine, servizi e server actions dipendono SOLO da queste interfacce.
 * L'implementazione concreta (oggi PostgreSQL, in futuro l'adapter
 * read-only verso ADV CORE) viene scelta in `./index.ts`.
 *
 * I filtri sono espressi nel linguaggio del dominio: nessuna colonna SQL
 * o nome legacy attraversa questo confine.
 */

export interface UserRepository {
  /** Restituisce l'utente con hash password: uso esclusivo del layer auth. */
  findByEmailWithCredentials(email: string): Promise<UserWithCredentials | null>;
  getById(id: EntityId): Promise<User | null>;
  /** Utenti attivi che possono essere assegnati come recruiter. */
  listRecruiters(): Promise<UserRef[]>;
  listActive(): Promise<UserRef[]>;
  create(input: { email: string; displayName: string; passwordHash: string | null; roles: RoleCode[] }): Promise<User>;
}

/** Statistiche aggregate per dashboard e report: solo conteggi, nessun dato personale. */
export interface ReportRepository {
  candidatesByStage(): Promise<Array<{ code: string; label: string; count: number }>>;
  applicationsByStage(range?: { from: Date; to: Date }): Promise<Array<{ code: string; label: string; count: number }>>;
  applicationsBySource(range?: { from: Date; to: Date }): Promise<Array<{ source: string; count: number }>>;
  selectionsByStatus(): Promise<Array<{ status: string; count: number }>>;
  interviewsByStatus(range: { from: Date; to: Date }): Promise<Array<{ status: string; count: number }>>;
  evaluationsByResult(range?: { from: Date; to: Date }): Promise<Array<{ result: string; count: number }>>;
  countCandidates(filter?: { createdSince?: Date; activeOnly?: boolean; withoutFeedback?: boolean }): Promise<number>;
  countApplications(filter: { stageCodes?: string[] }): Promise<number>;
  countSelections(filter: { statuses: string[] }): Promise<number>;
}

export interface Repositories {
  users: UserRepository;
  candidates: CandidateRepository;
  skills: SkillRepository;
  companies: CompanyRepository;
  selections: RecruitmentSelectionRepository;
  jobDescriptions: JobDescriptionRepository;
  stages: RecruitingStageRepository;
  applications: ApplicationRepository;
  interviews: InterviewRepository;
  feedbacks: FeedbackRepository;
  activities: ActivityRepository;
  audit: AuditLogRepository;
  tasks: TaskRepository;
  documents: DocumentRepository;
  talentPools: TalentPoolRepository;
  reports: ReportRepository;
}

/**
 * Punto d'accesso ai dati con supporto transazionale (unit of work).
 * Tutto ciò che viene eseguito dentro `transaction` usa gli stessi
 * repository legati alla transazione: commit o rollback atomico.
 */
export interface DataStore extends Repositories {
  transaction<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export class EntityNotFoundError extends Error {
  constructor(entity: string, id: EntityId) {
    super(`${entity} con id "${id}" non trovato`);
    this.name = "EntityNotFoundError";
  }
}
