import type { DataStore, Repositories } from "../types";
import { PostgresCandidateRepository, PostgresSkillRepository } from "./candidates";
import type { Database } from "./db";
import {
  PostgresActivityRepository,
  PostgresAuditLogRepository,
  PostgresDocumentRepository,
  PostgresFeedbackRepository,
  PostgresInterviewRepository,
  PostgresTalentPoolRepository,
  PostgresTaskRepository,
} from "./operations";
import {
  PostgresApplicationRepository,
  PostgresCompanyRepository,
  PostgresJobDescriptionRepository,
  PostgresSelectionRepository,
  PostgresStageRepository,
} from "./recruiting";
import { PostgresReportRepository } from "./reports";
import { PostgresUserRepository } from "./users";

export type { Database } from "./db";

export function createPostgresRepositories(db: Database): Repositories {
  return {
    users: new PostgresUserRepository(db),
    candidates: new PostgresCandidateRepository(db),
    skills: new PostgresSkillRepository(db),
    companies: new PostgresCompanyRepository(db),
    selections: new PostgresSelectionRepository(db),
    jobDescriptions: new PostgresJobDescriptionRepository(db),
    stages: new PostgresStageRepository(db),
    applications: new PostgresApplicationRepository(db),
    interviews: new PostgresInterviewRepository(db),
    feedbacks: new PostgresFeedbackRepository(db),
    activities: new PostgresActivityRepository(db),
    audit: new PostgresAuditLogRepository(db),
    tasks: new PostgresTaskRepository(db),
    documents: new PostgresDocumentRepository(db),
    talentPools: new PostgresTalentPoolRepository(db),
    reports: new PostgresReportRepository(db),
  };
}

/**
 * DataStore PostgreSQL. `transaction` apre una transazione Drizzle e passa
 * al lavoro un set di repository legati ad essa: in caso di eccezione
 * tutte le scritture (entità + activity + audit) vengono annullate.
 */
export function createPostgresDataStore(db: Database): DataStore {
  return {
    ...createPostgresRepositories(db),
    transaction: (work) => db.transaction((tx) => work(createPostgresRepositories(tx))),
  };
}
