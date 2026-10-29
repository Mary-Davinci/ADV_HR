import { endOfDay, endOfWeek, startOfDay, startOfWeek } from "date-fns";
import { z } from "zod";

import {
  ACTIVE_POLICY_PROGRAMS,
  DRIVING_LICENSE_CATEGORIES,
  EMPLOYMENT_STATUSES,
  REVIEW_STAGE_CODES,
  WORK_MODES,
  WORK_TIMES,
} from "@/domain";
import { CANDIDATE_SORT_OPTIONS, type CandidateSearchQuery, type CandidateSort } from "@/repositories/types";

export const INTERVIEW_WINDOWS = ["today", "week", "upcoming", "none"] as const;
export type InterviewWindow = (typeof INTERVIEW_WINDOWS)[number];

export const INTERVIEW_WINDOW_LABELS: Record<InterviewWindow, string> = {
  today: "Colloquio oggi",
  week: "Colloquio questa settimana",
  upcoming: "Con colloquio in programma",
  none: "Senza colloquio in programma",
};

export const SORT_LABELS: Record<CandidateSort, string> = {
  updatedAt_desc: "Ultima modifica",
  createdAt_desc: "Più recenti",
  lastName_asc: "Cognome (A–Z)",
  interview_asc: "Prossimo colloquio",
};

export const DEFAULT_SORT: CandidateSort = "updatedAt_desc";

/** Valore del filtro "politica attiva" che accetta qualsiasi programma. */
export const ANY_ACTIVE_POLICY = "ANY";

/** Gruppo di stage selezionabile come filtro unico. */
export const PENDING_REVIEW_FILTER = "PENDING_REVIEW";

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const text = (max: number) =>
  z
    .preprocess(firstValue, z.string().trim().max(max).optional())
    .catch(undefined)
    .transform((value) => value || undefined);
const oneOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(firstValue, z.enum(values).optional()).catch(undefined);
const yesNo = oneOf(["yes", "no"] as const);

/**
 * Filtri di ricerca candidati letti dai search params dell'URL.
 * Valori non validi vengono ignorati (`catch`): un URL manomesso mostra
 * semplicemente meno filtri, mai un errore o una query arbitraria.
 */
export const candidateFiltersSchema = z.object({
  q: text(100),
  city: text(80),
  region: text(60),
  skill: text(80),
  sector: text(80),
  language: text(40),
  employment: oneOf(EMPLOYMENT_STATUSES),
  protected: yesNo,
  relocate: yesNo,
  workMode: oneOf(WORK_MODES),
  workTime: oneOf(WORK_TIMES),
  license: oneOf(DRIVING_LICENSE_CATEGORIES),
  minExp: z.preprocess(firstValue, z.coerce.number().int().min(1).max(40).optional()).catch(undefined),
  policy: oneOf([ANY_ACTIVE_POLICY, ...ACTIVE_POLICY_PROGRAMS] as const),
  policyYear: z.preprocess(firstValue, z.coerce.number().int().min(2000).max(2100).optional()).catch(undefined),
  stage: z
    .preprocess(
      firstValue,
      z
        .string()
        .regex(/^[A-Z_]{2,40}$/)
        .optional(),
    )
    .catch(undefined),
  recruiter: z.preprocess(firstValue, z.uuid().optional()).catch(undefined),
  interview: oneOf(INTERVIEW_WINDOWS),
  sort: oneOf(CANDIDATE_SORT_OPTIONS),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(1000).optional()).catch(undefined),
});

export type CandidateFilters = z.infer<typeof candidateFiltersSchema>;

export const ADVANCED_FILTER_KEYS = [
  "city",
  "region",
  "skill",
  "sector",
  "language",
  "employment",
  "protected",
  "relocate",
  "workMode",
  "workTime",
  "license",
  "minExp",
  "policy",
  "policyYear",
] as const satisfies ReadonlyArray<keyof CandidateFilters>;

export function parseCandidateFilters(searchParams: Record<string, string | string[] | undefined>): CandidateFilters {
  return candidateFiltersSchema.parse(searchParams);
}

export function countAdvancedFilters(filters: CandidateFilters): number {
  return ADVANCED_FILTER_KEYS.filter((key) => filters[key] !== undefined).length;
}

export function hasActiveFilters(filters: CandidateFilters): boolean {
  return Boolean(
    filters.q || filters.stage || filters.recruiter || filters.interview || countAdvancedFilters(filters) > 0,
  );
}

export const PAGE_SIZE = 25;

/** Traduce i filtri UI nella query di dominio del repository. */
export function toCandidateSearchQuery(filters: CandidateFilters, now: Date): CandidateSearchQuery {
  const query: CandidateSearchQuery = {
    text: filters.q,
    city: filters.city,
    region: filters.region,
    skill: filters.skill,
    sector: filters.sector,
    language: filters.language,
    employmentStatus: filters.employment,
    protectedCategory: filters.protected === undefined ? undefined : filters.protected === "yes",
    willingToRelocate: filters.relocate === undefined ? undefined : filters.relocate === "yes",
    workMode: filters.workMode,
    workTime: filters.workTime,
    drivingLicense: filters.license,
    minExperienceMonths: filters.minExp ? filters.minExp * 12 : undefined,
    activePolicy: filters.policy,
    activePolicyYear: filters.policyYear,
    stageCodes: filters.stage
      ? filters.stage === PENDING_REVIEW_FILTER
        ? [...REVIEW_STAGE_CODES]
        : [filters.stage]
      : undefined,
    recruiterId: filters.recruiter,
    sort: filters.sort ?? DEFAULT_SORT,
    limit: PAGE_SIZE,
    offset: ((filters.page ?? 1) - 1) * PAGE_SIZE,
  };

  switch (filters.interview) {
    case "today":
      query.interviewFrom = startOfDay(now);
      query.interviewTo = endOfDay(now);
      break;
    case "week":
      query.interviewFrom = startOfWeek(now, { weekStartsOn: 1 });
      query.interviewTo = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "upcoming":
      query.interviewFrom = now;
      break;
    case "none":
      query.withoutInterview = true;
      break;
  }
  return query;
}

/** Serializza i filtri in query string (omette default e valori vuoti). */
export function toSearchParams(filters: Partial<CandidateFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "sort" && value === DEFAULT_SORT) continue;
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
