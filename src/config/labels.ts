import type {
  ActivePolicyProgram,
  ActivePolicyStatus,
  ActivityAction,
  ApplicationSource,
  AvailabilityType,
  CandidateOrigin,
  ContactAction,
  DocumentProcessingStatus,
  DocumentType,
  DrivingLicenseCategory,
  EducationLevel,
  EmploymentStatus,
  EvaluationResult,
  ExperienceLevel,
  FeedbackType,
  Gender,
  HiringDocument,
  HiringIncentive,
  InterviewStatus,
  InterviewType,
  JobContractType,
  JobRequestStatus,
  LanguageLevel,
  MatchingEvidenceStatus,
  MatchingOverallStatus,
  ProtectedCategory,
  RoleCode,
  SelectionStatus,
  SkillCategory,
  TaskPriority,
  TaskStatus,
  WorkDay,
  WorkMode,
  WorkTime,
} from "@/domain";

/**
 * Label italiane centralizzate. L'interfaccia non mostra MAI i valori
 * tecnici degli enum: usa sempre queste mappe (o `labelOf`).
 */

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: "Donna",
  MALE: "Uomo",
  NON_BINARY: "Non binario",
  NOT_SPECIFIED: "Non indicato",
};

export const PROTECTED_CATEGORY_LABELS: Record<ProtectedCategory, string> = {
  NONE: "No",
  ART_1: "Sì – art. 1, L. 68/99",
  ART_18: "Sì – art. 18, L. 68/99",
  NOT_SPECIFIED: "Non indicato",
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  EMPLOYED: "Occupato",
  UNEMPLOYED: "Disoccupato",
  INACTIVE: "Inattivo",
  UNKNOWN: "Non indicato",
};

export const WORK_TIME_LABELS: Record<WorkTime, string> = {
  FULL_TIME: "Tempo pieno",
  PART_TIME: "Part-time",
  EITHER: "Indifferente",
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: "In sede",
  REMOTE: "Da remoto",
  HYBRID: "Ibrido",
  FLEXIBLE: "Flessibile",
};

export const AVAILABILITY_LABELS: Record<AvailabilityType, string> = {
  IMMEDIATE: "Immediata",
  WITHIN_2_WEEKS: "Entro 2 settimane",
  WITHIN_1_MONTH: "Entro 1 mese",
  OVER_1_MONTH: "Oltre 1 mese",
  NOT_AVAILABLE: "Non disponibile",
};

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  LOWER_SECONDARY: "Licenza media",
  VOCATIONAL: "Qualifica professionale",
  UPPER_SECONDARY: "Diploma",
  POST_SECONDARY: "ITS / IFTS",
  BACHELOR: "Laurea triennale",
  MASTER: "Laurea magistrale",
  DOCTORATE: "Dottorato",
  OTHER: "Altro",
};

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  TECHNICAL: "Tecnica",
  DIGITAL: "Digitale",
  SOFT: "Trasversale",
  OTHER: "Altro",
};

export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  A1: "A1 – Base",
  A2: "A2 – Elementare",
  B1: "B1 – Intermedio",
  B2: "B2 – Intermedio superiore",
  C1: "C1 – Avanzato",
  C2: "C2 – Padronanza",
  NATIVE: "Madrelingua",
};

export const DRIVING_LICENSE_LABELS: Record<DrivingLicenseCategory, string> = {
  AM: "AM",
  A1: "A1",
  A2: "A2",
  A: "A",
  B: "B",
  BE: "BE",
  C1: "C1",
  C1E: "C1E",
  C: "C",
  CE: "CE",
  D1: "D1",
  D1E: "D1E",
  D: "D",
  DE: "DE",
  CQC_GOODS: "CQC merci",
  CQC_PASSENGERS: "CQC persone",
  FORKLIFT: "Patentino carrelli elevatori",
};

export const ACTIVE_POLICY_PROGRAM_LABELS: Record<ActivePolicyProgram, string> = {
  GOL: "GOL",
  GARANZIA_GIOVANI: "Garanzia Giovani",
  DOTE_UNICA_LAVORO: "Dote Unica Lavoro",
  TIROCINIO: "Tirocinio",
  ASSEGNO_RICOLLOCAZIONE: "Assegno di ricollocazione",
  DIL: "DIL",
  OTHER: "Altro programma",
};

export const ACTIVE_POLICY_STATUS_LABELS: Record<ActivePolicyStatus, string> = {
  ACTIVE: "In corso",
  COMPLETED: "Concluso",
  INTERRUPTED: "Interrotto",
};

export const CANDIDATE_ORIGIN_LABELS: Record<CandidateOrigin, string> = {
  ADV_CORE: "ADV Core",
  INDEED: "Indeed",
  LINKEDIN: "LinkedIn",
  MANUAL: "Inserito a mano",
};

export const SELECTION_STATUS_LABELS: Record<SelectionStatus, string> = {
  DRAFT: "Bozza",
  OPEN: "Aperta",
  PAUSED: "In pausa",
  CLOSED: "Chiusa",
  ARCHIVED: "Archiviata",
};

export const APPLICATION_SOURCE_LABELS: Record<ApplicationSource, string> = {
  MANUAL: "Inserimento manuale",
  ADV_HR: "ADV_HR",
  ADV_CORE: "ADV CORE",
  INDEED: "Indeed",
  LINKEDIN: "LinkedIn",
  WEBSITE: "Sito web",
  EMAIL: "Email",
  REFERRAL: "Segnalazione",
  OTHER: "Altro",
};

export const EVALUATION_RESULT_LABELS: Record<EvaluationResult, string> = {
  SUITABLE: "Idoneo",
  NOT_SUITABLE: "Non idoneo",
  TO_REVIEW: "Da rivalutare",
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  SCREENING: "Screening telefonico",
  HR: "Colloquio HR",
  TECHNICAL: "Colloquio tecnico",
  CLIENT: "Colloquio con il cliente",
  FOLLOW_UP: "Follow-up",
  OTHER: "Altro",
};

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Programmato",
  COMPLETED: "Svolto",
  CANCELLED: "Annullato",
  NO_SHOW: "Non presentato",
};

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  GENERAL: "Nota generale",
  INTERVIEW: "Esito colloquio",
  PHONE_SCREENING: "Screening telefonico",
  CLIENT: "Riscontro cliente",
  INTERNAL_NOTE: "Nota interna",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Bassa",
  MEDIUM: "Media",
  HIGH: "Alta",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Da fare",
  IN_PROGRESS: "In corso",
  DONE: "Completato",
  CANCELLED: "Annullato",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CV: "Curriculum vitae",
  COVER_LETTER: "Lettera di presentazione",
  CERTIFICATION: "Certificazione",
  IDENTITY_DOCUMENT: "Documento d'identità",
  JOB_DESCRIPTION: "Job description",
  CONTRACT: "Contratto",
  OTHER: "Altro",
};

export const DOCUMENT_PROCESSING_LABELS: Record<DocumentProcessingStatus, string> = {
  UPLOADED: "Caricato",
  PENDING: "In elaborazione",
  PROCESSED: "Elaborato",
  FAILED: "Elaborazione non riuscita",
};

export const CONTACT_ACTION_LABELS: Record<ContactAction, string> = {
  PHONE_CALL: "Telefonata",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  INTERVIEW: "Colloquio",
  FOLLOW_UP: "Follow-up",
  OTHER_CONTACT: "Altro contatto",
};

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  CREATED: "Creato",
  UPDATED: "Aggiornato",
  STATUS_CHANGED: "Stato cambiato",
  INTERVIEW_SCHEDULED: "Colloquio programmato",
  INTERVIEW_UPDATED: "Colloquio aggiornato",
  INTERVIEW_COMPLETED: "Colloquio svolto",
  INTERVIEW_CANCELLED: "Colloquio annullato",
  FEEDBACK_ADDED: "Feedback aggiunto",
  EVALUATION_ADDED: "Valutazione registrata",
  DOCUMENT_UPLOADED: "Documento caricato",
  DOCUMENT_DELETED: "Documento eliminato",
  TASK_CREATED: "Task creato",
  TASK_COMPLETED: "Task completato",
  ADDED_TO_POOL: "Aggiunto al talent pool",
  REMOVED_FROM_POOL: "Rimosso dal talent pool",
  APPLICATION_CREATED: "Candidatura creata",
  APPLICATION_REMOVED: "Candidatura rimossa dalla selezione",
  ...CONTACT_ACTION_LABELS,
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "Amministratore",
  HR_MANAGER: "Responsabile HR",
  RECRUITER: "Recruiter",
  VIEWER: "Consultazione",
};

export const MATCHING_EVIDENCE_LABELS: Record<MatchingEvidenceStatus, string> = {
  PASS: "Soddisfatto",
  FAIL: "Non soddisfatto",
  UNKNOWN: "Dato non disponibile",
  REVIEW_REQUIRED: "Da verificare",
};

/** Formulazioni prudenti: nessun "candidato perfetto". */
export const MATCHING_OVERALL_LABELS: Record<MatchingOverallStatus, string> = {
  SUGGESTED: "Profilo suggerito",
  COHERENT: "Profilo coerente",
  PARTIAL: "Compatibilità parziale",
  TO_VERIFY: "Da verificare",
  NOT_COMPATIBLE: "Requisiti non soddisfatti",
};

/** Label con fallback leggibile per valori non (ancora) mappati. */
export function labelOf<T extends string>(
  labels: Record<T, string>,
  value: T | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined) return fallback;
  return labels[value] ?? fallback;
}

/* Richiesta di personale (modulo Job Description) */

export const JOB_REQUEST_STATUS_LABELS: Record<JobRequestStatus, string> = {
  DRAFT: "Bozza",
  SENT: "Inviata all'azienda",
  READY: "Compilata, in attesa di firma",
  SIGNED: "Firmata, da verificare",
  OPENED: "Selezione aperta",
  CANCELLED: "Annullata",
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  NONE: "Nessuna",
  JUNIOR: "Junior",
  SENIOR: "Senior",
};

export const JOB_CONTRACT_TYPE_LABELS: Record<JobContractType, string> = {
  PERMANENT: "Tempo indeterminato",
  FIXED_TERM: "Tempo determinato",
  INTERNSHIP: "Tirocinio",
  OTHER: "Altro",
};

export const WORK_DAY_LABELS: Record<WorkDay, string> = {
  MON: "Lunedì",
  TUE: "Martedì",
  WED: "Mercoledì",
  THU: "Giovedì",
  FRI: "Venerdì",
  SAT: "Sabato",
  SUN: "Domenica",
};

export const HIRING_INCENTIVE_LABELS: Record<HiringIncentive, string> = {
  APPRENTICESHIP: "Apprendistato",
  PROTECTED_CATEGORIES: "Categorie protette (L. 68/99)",
  LONG_TERM_UNEMPLOYED: "Iscritti di lunga durata (L. 407/90)",
  MOBILITY_LISTS: "Iscrizione liste di mobilità",
  INSERTION_CONTRACT: "Contratto di inserimento",
  OTHER: "Altro",
};

export const HIRING_DOCUMENT_LABELS: Record<HiringDocument, string> = {
  SAP_RECORD: "Scheda anagrafica/C2 storico (SAP)",
  DID: "DID",
  SERVICE_AGREEMENT: "Patto di servizio",
  IDENTITY_DOCUMENT: "Documento d'identità e C.F.",
  UPDATED_CV: "CV aggiornato",
  TARGETED_PLACEMENT: "Attestazione iscrizione liste di collocamento mirato",
  OTHER: "Altro",
};

/** Regioni italiane, con la grafia usata da ADV Core (filtri per regione). */
export const ITALIAN_REGIONS = [
  "Abruzzo",
  "Basilicata",
  "Calabria",
  "Campania",
  "Emilia-Romagna",
  "Friuli-Venezia Giulia",
  "Lazio",
  "Liguria",
  "Lombardia",
  "Marche",
  "Molise",
  "Piemonte",
  "Puglia",
  "Sardegna",
  "Sicilia",
  "Toscana",
  "Trentino-Alto Adige",
  "Umbria",
  "Valle d'Aosta",
  "Veneto",
] as const;

/** Opzioni per select a partire da una mappa di label (ordine della mappa). */
export function optionsOf<T extends string>(labels: Record<T, string>): Array<{ value: T; label: string }> {
  return (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }));
}
