import { differenceInCalendarMonths, parseISO } from "date-fns";

import type { AuditInfo, EntityId, ISODate } from "./shared";

/* ------------------------------------------------------------------ */
/* Enum                                                                 */
/* ------------------------------------------------------------------ */

export const GENDERS = ["FEMALE", "MALE", "NON_BINARY", "NOT_SPECIFIED"] as const;
export type Gender = (typeof GENDERS)[number];

/** Appartenenza a categorie protette (L. 68/99). */
export const PROTECTED_CATEGORIES = ["NONE", "ART_1", "ART_18", "NOT_SPECIFIED"] as const;
export type ProtectedCategory = (typeof PROTECTED_CATEGORIES)[number];

export const EMPLOYMENT_STATUSES = ["EMPLOYED", "UNEMPLOYED", "INACTIVE", "UNKNOWN"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Tipologia/orario desiderati o offerti: stessi valori per candidato e job description. */
export const WORK_TIMES = ["FULL_TIME", "PART_TIME", "EITHER"] as const;
export type WorkTime = (typeof WORK_TIMES)[number];

export const WORK_MODES = ["ONSITE", "REMOTE", "HYBRID", "FLEXIBLE"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const AVAILABILITY_TYPES = [
  "IMMEDIATE",
  "WITHIN_2_WEEKS",
  "WITHIN_1_MONTH",
  "OVER_1_MONTH",
  "NOT_AVAILABLE",
] as const;
export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number];

export const EDUCATION_LEVELS = [
  "LOWER_SECONDARY",
  "VOCATIONAL",
  "UPPER_SECONDARY",
  "POST_SECONDARY",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "OTHER",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const SKILL_CATEGORIES = ["TECHNICAL", "DIGITAL", "SOFT", "OTHER"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "NATIVE"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const DRIVING_LICENSE_CATEGORIES = [
  "AM",
  "A1",
  "A2",
  "A",
  "B",
  "BE",
  "C1",
  "C1E",
  "C",
  "CE",
  "D1",
  "D1E",
  "D",
  "DE",
  "CQC_GOODS",
  "CQC_PASSENGERS",
  "FORKLIFT",
] as const;
export type DrivingLicenseCategory = (typeof DRIVING_LICENSE_CATEGORIES)[number];

export const ACTIVE_POLICY_PROGRAMS = [
  "GOL",
  "GARANZIA_GIOVANI",
  "DOTE_UNICA_LAVORO",
  "TIROCINIO",
  "ASSEGNO_RICOLLOCAZIONE",
  "DIL",
  "OTHER",
] as const;
export type ActivePolicyProgram = (typeof ACTIVE_POLICY_PROGRAMS)[number];

export const ACTIVE_POLICY_STATUSES = ["ACTIVE", "COMPLETED", "INTERRUPTED"] as const;
export type ActivePolicyStatus = (typeof ACTIVE_POLICY_STATUSES)[number];

/** Permesso di soggiorno: non necessario per cittadini italiani e UE. */
export const RESIDENCE_PERMIT_STATUSES = ["NOT_REQUIRED", "VALID", "REQUESTED", "PENDING", "EXPIRED", "NONE"] as const;
export type ResidencePermitStatus = (typeof RESIDENCE_PERMIT_STATUSES)[number];

/**
 * Il permesso di soggiorno conta solo per chi non è cittadino italiano o UE:
 * escluso se HR lo ha indicato come non necessario o se la nazionalità è italiana.
 */
export function needsResidencePermit(candidate: Pick<Candidate, "nationality" | "residencePermitStatus">): boolean {
  if (candidate.residencePermitStatus === "NOT_REQUIRED") return false;
  return !/^\s*ital/i.test(candidate.nationality ?? "");
}

/** Da dove arriva il candidato: importato da ADV CORE, dalle piattaforme di annunci o inserito a mano. */
export const CANDIDATE_ORIGINS = ["ADV_CORE", "INDEED", "LINKEDIN", "MANUAL", "WEBSITE"] as const;
export type CandidateOrigin = (typeof CANDIDATE_ORIGINS)[number];

/* ------------------------------------------------------------------ */
/* Entità                                                               */
/* ------------------------------------------------------------------ */

/** Identità essenziale del candidato. I dati di processo stanno nelle candidature. */
export interface Candidate extends AuditInfo {
  id: EntityId;
  firstName: string;
  lastName: string;
  fiscalCode: string | null;
  email: string | null;
  phone: string | null;
  birthDate: ISODate | null;
  gender: Gender;
  nationality: string | null;
  residencePermitStatus: ResidencePermitStatus | null;
  residencePermitExpiresOn: ISODate | null;
  /** Motivo se il permesso manca o è negato, oppure altre note utili alla selezione. */
  residencePermitNotes: string | null;
  origin: CandidateOrigin;
  /** Data in cui ha completato il percorso di orientamento; null = non completato. */
  orientationCompletedOn: ISODate | null;
  /**
   * Politiche attive che si possono attivare per il candidato (valutazione HR),
   * distinte da quelle già sottoscritte (`ActivePolicyParticipation`).
   */
  activatablePolicies: ActivePolicyProgram[];
  /** Note HR sul percorso, ad esempio il motivo per cui non partecipa ad alcun programma. */
  trackingNotes: string | null;
  /** Recruiter di riferimento assegnato da HR; null = deducibile solo dalle candidature. */
  recruiterId: EntityId | null;
}

/** Dati di percorso modificabili da HR, separati dall'anagrafica. */
export interface CandidateTrackingInput {
  origin: CandidateOrigin;
  orientationCompletedOn: ISODate | null;
  activatablePolicies: ActivePolicyProgram[];
  trackingNotes: string | null;
}

export interface CandidateProfile {
  candidateId: EntityId;
  residenceAddress: string | null;
  residencePostalCode: string | null;
  residenceCity: string | null;
  residenceProvince: string | null;
  residenceRegion: string | null;
  residenceCountry: string | null;
  experienceSector: string | null;
  experienceMonths: number | null;
  protectedCategory: ProtectedCategory;
  protectedCategoryNotes: string | null;
  employmentStatus: EmploymentStatus;
  professionalSummary: string | null;
  lastReviewedAt: Date | null;
  updatedAt: Date;
}

export interface CandidatePreferences {
  candidateId: EntityId;
  availability: AvailabilityType | null;
  desiredEmploymentType: WorkTime | null;
  desiredWorkTime: WorkTime | null;
  desiredWorkMode: WorkMode | null;
  willingToRelocate: boolean | null;
  willingToTravel: boolean | null;
  preferredLocations: string[];
  availabilityNotes: string | null;
  updatedAt: Date;
}

export interface CandidateExperience {
  id: EntityId;
  candidateId: EntityId;
  companyName: string;
  roleTitle: string;
  sector: string | null;
  startDate: ISODate;
  endDate: ISODate | null;
  description: string | null;
  currentRole: boolean;
}

export interface CandidateEducation {
  id: EntityId;
  candidateId: EntityId;
  qualification: string;
  fieldOfStudy: string | null;
  institution: string | null;
  year: number | null;
  level: EducationLevel;
  notes: string | null;
}

export interface CandidateInterest {
  id: EntityId;
  candidateId: EntityId;
  sector: string;
  priority: number | null;
}

export interface Skill {
  id: EntityId;
  name: string;
  category: SkillCategory;
  normalizedName: string;
}

export interface CandidateSkill {
  candidateId: EntityId;
  skill: Skill;
  /** 1 (base) – 5 (esperto). */
  level: number | null;
  yearsExperience: number | null;
  verified: boolean;
  notes: string | null;
}

export interface CandidateLanguage {
  id: EntityId;
  candidateId: EntityId;
  language: string;
  level: LanguageLevel;
  certified: boolean;
  notes: string | null;
}

export interface CandidateCertification {
  id: EntityId;
  candidateId: EntityId;
  name: string;
  issuer: string | null;
  issuedAt: ISODate | null;
  expiresAt: ISODate | null;
  credentialId: string | null;
  notes: string | null;
}

export interface CandidateDrivingLicense {
  id: EntityId;
  candidateId: EntityId;
  category: DrivingLicenseCategory;
  valid: boolean;
  notes: string | null;
}

export interface ActivePolicyParticipation {
  id: EntityId;
  candidateId: EntityId;
  programType: ActivePolicyProgram;
  referenceYear: number;
  status: ActivePolicyStatus | null;
  notes: string | null;
}

export interface Tag {
  id: EntityId;
  name: string;
  slug: string;
}

/* ------------------------------------------------------------------ */
/* Regole di dominio                                                    */
/* ------------------------------------------------------------------ */

export function getCandidateFullName(candidate: Pick<Candidate, "firstName" | "lastName">): string {
  return `${candidate.firstName} ${candidate.lastName}`.trim();
}

/**
 * Durata di un'esperienza in mesi. È derivata (mai salvata): per i ruoli
 * in corso si usa la data di riferimento `now`.
 */
export function getExperienceDurationMonths(
  experience: Pick<CandidateExperience, "startDate" | "endDate">,
  now: Date = new Date(),
): number {
  const end = experience.endDate ? parseISO(experience.endDate) : now;
  return Math.max(0, differenceInCalendarMonths(end, parseISO(experience.startDate)));
}

/** Somma dei mesi di esperienza, senza contare due volte i periodi sovrapposti. */
export function getTotalExperienceMonths(
  experiences: Array<Pick<CandidateExperience, "startDate" | "endDate">>,
  now: Date = new Date(),
): number {
  const intervals = experiences
    .map((experience) => ({
      start: parseISO(experience.startDate).getTime(),
      end: (experience.endDate ? parseISO(experience.endDate) : now).getTime(),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  let months = 0;
  let current: { start: number; end: number } | null = null;
  for (const interval of intervals) {
    if (current && interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
      continue;
    }
    if (current) months += differenceInCalendarMonths(current.end, current.start);
    current = { ...interval };
  }
  if (current) months += differenceInCalendarMonths(current.end, current.start);
  return months;
}

/**
 * Radice di un termine di ricerca professionale (mestiere, settore): toglie la
 * desinenza così che "idraulico" trovi anche "idraulica" e "termoidraulica",
 * "elettricista" anche "elettricisti". Termini corti restano invariati.
 */
export function professionSearchStem(term: string): string {
  const word = term.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  if (word.length < 5 || !/^\p{L}+$/u.test(word)) return word;
  if (/[cg]h[ei]$/.test(word)) return word.slice(0, -2);
  return word.replace(/[aeiou]$/, "");
}

export function normalizeSkillName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
