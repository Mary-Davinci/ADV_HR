import type { Company } from "./company";
import type { AuditInfo, EntityId, ISODate, LocalTime, UserRef } from "./shared";

/* ------------------------------------------------------------------ */
/* Richiesta di personale (modulo "Job Description" dell'azienda)       */
/* ------------------------------------------------------------------ */

/**
 * Ciclo di vita: la selezione si apre SOLO da una richiesta firmata.
 *
 *   DRAFT ──(invio all'azienda)──▶ SENT ──(l'azienda compila)──▶ READY ──(firmato)──▶ SIGNED ──(HR approva)──▶ OPENED
 *     └──────────(HR compila internamente)─────────────────▲
 *   Riapertura da READY/SIGNED: torna a SENT (se inviata) o DRAFT.   CANCELLED da qualsiasi stato non concluso.
 *
 * Ogni riapertura incrementa `revision`: il PDF firmato deve riportare
 * codice e revisione correnti.
 */
export const JOB_REQUEST_STATUSES = ["DRAFT", "SENT", "READY", "SIGNED", "OPENED", "CANCELLED"] as const;
export type JobRequestStatus = (typeof JOB_REQUEST_STATUSES)[number];

export const EXPERIENCE_LEVELS = ["NONE", "JUNIOR", "SENIOR"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const JOB_CONTRACT_TYPES = ["PERMANENT", "FIXED_TERM", "INTERNSHIP", "OTHER"] as const;
export type JobContractType = (typeof JOB_CONTRACT_TYPES)[number];

export const WORK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type WorkDay = (typeof WORK_DAYS)[number];

export const HIRING_INCENTIVES = [
  "APPRENTICESHIP",
  "PROTECTED_CATEGORIES",
  "LONG_TERM_UNEMPLOYED",
  "MOBILITY_LISTS",
  "INSERTION_CONTRACT",
  "OTHER",
] as const;
export type HiringIncentive = (typeof HIRING_INCENTIVES)[number];

export const HIRING_DOCUMENTS = [
  "SAP_RECORD",
  "DID",
  "SERVICE_AGREEMENT",
  "IDENTITY_DOCUMENT",
  "UPDATED_CV",
  "TARGETED_PLACEMENT",
  "OTHER",
] as const;
export type HiringDocument = (typeof HIRING_DOCUMENTS)[number];

/** Contenuto del modulo, con la stessa struttura del cartaceo ufficiale. */
export interface JobRequestForm {
  company: {
    name: string;
    vatOrFiscalCode: string;
    registeredOffice: string;
    operatingOffice: string | null;
    phone: string;
    adminEmail: string;
    pec: string;
    sdiCode: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
  profile: {
    role: string;
    positions: number;
    experience: ExperienceLevel;
    city: string;
    province: string;
    travel: boolean;
    duties: string;
    activities: string;
    education: string | null;
    drivingLicense: string | null;
    certifications: string | null;
    mandatoryRequirements: string | null;
    expectedHireDate: ISODate | null;
  };
  contract: {
    type: JobContractType;
    fixedTermMonths: number | null;
    otherType: string | null;
    ccnl: string | null;
    level: string | null;
    monthlySalary: string | null;
    annualSalary: string | null;
    benefits: string | null;
    fullTime: boolean;
    from: LocalTime;
    to: LocalTime;
    weeklyHours: number;
    days: WorkDay[];
    holidayWork: boolean;
    onSite: boolean;
    smartWorking: boolean;
    smartWorkingDays: string | null;
  };
  incentives: {
    types: HiringIncentive[];
    other: string | null;
    expectedHireMonth: string | null;
    notes: string | null;
  };
  documents: {
    required: HiringDocument[];
    other: string | null;
  };
  companyNotes: string | null;
  consent: {
    signatoryName: string;
    granted: boolean;
  };
}

/**
 * Valori del modulo così come li inserisce l'utente (stringhe dei controlli,
 * anche incompleti). Si salvano tali e quali, anche in bozza; la versione
 * normalizzata `JobRequestForm` si ottiene SOLO tramite lo schema di
 * validazione completo della feature.
 */
export interface JobRequestFormValues {
  company: {
    name: string;
    vatOrFiscalCode: string;
    registeredOffice: string;
    operatingOffice: string;
    phone: string;
    adminEmail: string;
    pec: string;
    sdiCode: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
  profile: {
    role: string;
    positions: string;
    experience: ExperienceLevel | "";
    city: string;
    province: string;
    travel: "true" | "false" | "";
    duties: string;
    activities: string;
    education: string;
    drivingLicense: string;
    certifications: string;
    mandatoryRequirements: string;
    expectedHireDate: string;
  };
  contract: {
    type: JobContractType | "";
    fixedTermMonths: string;
    otherType: string;
    ccnl: string;
    level: string;
    monthlySalary: string;
    annualSalary: string;
    benefits: string;
    schedule: "FULL" | "PART" | "";
    from: string;
    to: string;
    weeklyHours: string;
    days: WorkDay[];
    holidayWork: "true" | "false" | "";
    onSite: boolean;
    smartWorking: boolean;
    smartWorkingDays: string;
  };
  incentives: {
    types: HiringIncentive[];
    other: string;
    expectedHireMonth: string;
    notes: string;
  };
  documents: {
    required: HiringDocument[];
    other: string;
  };
  companyNotes: string;
  consent: {
    signatoryName: string;
    granted: boolean;
  };
}

export interface JobRequest extends AuditInfo {
  id: EntityId;
  companyId: EntityId;
  /** Codice stampato sul PDF (es. `JR-7K3M9Q`): lega il firmato alla richiesta. */
  code: string;
  revision: number;
  status: JobRequestStatus;
  form: JobRequestFormValues;
  /** Modulo validato in modo completo (da READY in poi): unica fonte di PDF e selezione. */
  validatedForm: JobRequestForm | null;
  signedDocumentId: EntityId | null;
  selectionId: EntityId | null;
  reviewNote: string | null;
  /** Destinatario del link (referente dell'azienda). */
  recipientEmail: string | null;
  /** Scadenza del link personale; il token è salvato solo come hash. */
  accessExpiresAt: Date | null;
  sentAt: Date | null;
  /** Ultimo invio del modulo completo da parte dell'azienda. */
  submittedAt: Date | null;
  createdBy: UserRef | null;
  approvedBy: UserRef | null;
  approvedAt: Date | null;
}

/** Stati in cui il contenuto del modulo si può ancora modificare. */
export const EDITABLE_JOB_REQUEST_STATUSES: readonly JobRequestStatus[] = ["DRAFT", "SENT"];

/**
 * Partita IVA italiana: 11 cifre con cifra di controllo (algoritmo di Luhn
 * nella variante dell'Agenzia delle Entrate).
 */
export function isValidVatNumber(value: string): boolean {
  if (!/^\d{11}$/.test(value) || value === "00000000000") return false;
  let sum = 0;
  for (let index = 0; index < 10; index++) {
    let digit = Number(value[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}

/** Valori iniziali di una nuova richiesta, precompilati dall'anagrafica dell'azienda. */
export function initialJobRequestValues(
  company: Pick<Company, "name" | "vatNumber" | "fiscalCode" | "email" | "phone" | "city" | "province">,
): JobRequestFormValues {
  return {
    company: {
      name: company.name,
      vatOrFiscalCode: company.vatNumber ?? company.fiscalCode ?? "",
      registeredOffice: "",
      operatingOffice: "",
      phone: company.phone ?? "",
      adminEmail: company.email ?? "",
      pec: "",
      sdiCode: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
    profile: {
      role: "",
      positions: "1",
      experience: "",
      city: company.city ?? "",
      province: company.province ?? "",
      travel: "",
      duties: "",
      activities: "",
      education: "",
      drivingLicense: "",
      certifications: "",
      mandatoryRequirements: "",
      expectedHireDate: "",
    },
    contract: {
      type: "",
      fixedTermMonths: "",
      otherType: "",
      ccnl: "",
      level: "",
      monthlySalary: "",
      annualSalary: "",
      benefits: "",
      schedule: "",
      from: "",
      to: "",
      weeklyHours: "",
      days: [],
      holidayWork: "",
      onSite: true,
      smartWorking: false,
      smartWorkingDays: "",
    },
    incentives: { types: [], other: "", expectedHireMonth: "", notes: "" },
    documents: { required: [], other: "" },
    companyNotes: "",
    consent: { signatoryName: "", granted: false },
  };
}
