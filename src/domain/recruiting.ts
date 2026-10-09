import type { WorkMode, WorkTime } from "./candidate";
import type { AuditInfo, EntityId, UserRef } from "./shared";

/* ------------------------------------------------------------------ */
/* Selezioni aziendali e job description                                */
/* ------------------------------------------------------------------ */

export const SELECTION_STATUSES = ["DRAFT", "OPEN", "PAUSED", "CLOSED", "ARCHIVED"] as const;
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export interface RecruitmentSelection extends AuditInfo {
  id: EntityId;
  companyId: EntityId;
  title: string;
  status: SelectionStatus;
  openedAt: Date | null;
  closedAt: Date | null;
  createdBy: EntityId | null;
}

export interface JobDescription extends AuditInfo {
  id: EntityId;
  selectionId: EntityId;
  title: string;
  summary: string | null;
  duties: string | null;
  requirements: string | null;
  employmentType: WorkTime | null;
  workTime: WorkTime | null;
  workMode: WorkMode | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  workingHours: string | null;
  locationCity: string | null;
  locationProvince: string | null;
  locationRegion: string | null;
  notes: string | null;
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                             */
/* ------------------------------------------------------------------ */

/**
 * Stage della pipeline. Configurabili da database: il codice non deve
 * assumere che esista un insieme fisso. I codici seguenti sono solo il
 * seed iniziale e i riferimenti usati da regole esplicite.
 */
export const DEFAULT_STAGE_CODES = [
  "NEW",
  "TO_REVIEW",
  "CONTACTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "SECOND_INTERVIEW",
  "SELECTED",
  "REJECTED",
  "ON_HOLD",
] as const;

/**
 * Stage con regole di dominio esplicite. Lo scarto richiede SEMPRE una
 * motivazione (registrata come valutazione "non idoneo").
 */
export const REJECTION_STAGE_CODE = "REJECTED";
export const INITIAL_STAGE_CODE = "NEW";

/** Stage che indicano una candidatura ancora da esaminare (KPI "da revisionare"). */
export const REVIEW_STAGE_CODES = ["NEW", "TO_REVIEW"] as const;

export interface RecruitingStage {
  id: EntityId;
  code: string;
  label: string;
  position: number;
  active: boolean;
  isTerminal: boolean;
}

export const APPLICATION_SOURCES = [
  "MANUAL",
  "ADV_HR",
  "ADV_CORE",
  "INDEED",
  "LINKEDIN",
  "WEBSITE",
  "EMAIL",
  "REFERRAL",
  "OTHER",
] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

/** Candidatura: collega un candidato a una selezione aziendale. */
export interface Application extends AuditInfo {
  id: EntityId;
  candidateId: EntityId;
  selectionId: EntityId;
  stageId: EntityId;
  recruiterId: EntityId | null;
  source: ApplicationSource;
  closedAt: Date | null;
}

/* ------------------------------------------------------------------ */
/* Valutazione idoneo / non idoneo                                      */
/* ------------------------------------------------------------------ */

export const EVALUATION_RESULTS = ["SUITABLE", "NOT_SUITABLE", "TO_REVIEW"] as const;
export type EvaluationResult = (typeof EVALUATION_RESULTS)[number];

/** La valutazione appartiene alla candidatura (candidato × selezione), non al candidato. */
export interface ApplicationEvaluation {
  id: EntityId;
  applicationId: EntityId;
  result: EvaluationResult;
  reason: string | null;
  notes: string | null;
  evaluatedBy: UserRef;
  evaluatedAt: Date;
}

/** Regola di dominio: un "non idoneo" richiede sempre una motivazione. */
export function isEvaluationReasonRequired(result: EvaluationResult): boolean {
  return result === "NOT_SUITABLE";
}

export class DomainRuleError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DomainRuleError";
  }
}

export function assertValidEvaluation(input: { result: EvaluationResult; reason?: string | null }): void {
  if (isEvaluationReasonRequired(input.result) && !input.reason?.trim()) {
    throw new DomainRuleError("La motivazione è obbligatoria per una valutazione di non idoneità.", "REASON_REQUIRED");
  }
}
