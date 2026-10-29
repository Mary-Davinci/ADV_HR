import type {
  ActivePolicyParticipation,
  ActivePolicyProgram,
  AvailabilityType,
  Candidate,
  CandidateCertification,
  CandidateDrivingLicense,
  CandidateEducation,
  CandidateExperience,
  CandidateInterest,
  CandidateLanguage,
  CandidatePreferences,
  CandidateProfile,
  CandidateSkill,
  DrivingLicenseCategory,
  EducationLevel,
  EmploymentStatus,
  EntityId,
  Gender,
  ISODate,
  Page,
  PageRequest,
  ProtectedCategory,
  Skill,
  SkillCategory,
  Tag,
  UserRef,
  WorkMode,
  WorkTime,
} from "@/domain";

/* ------------------------------------------------------------------ */
/* Ricerca                                                              */
/* ------------------------------------------------------------------ */

export const CANDIDATE_SORT_OPTIONS = ["updatedAt_desc", "createdAt_desc", "lastName_asc", "interview_asc"] as const;
export type CandidateSort = (typeof CANDIDATE_SORT_OPTIONS)[number];

/** Filtri strutturati espressi nel linguaggio del dominio (mai colonne SQL). */
export interface CandidateSearchQuery extends PageRequest {
  text?: string;
  city?: string;
  region?: string;
  skill?: string;
  sector?: string;
  employmentStatus?: EmploymentStatus;
  /** `true` = appartiene a una categoria protetta (art. 1 o art. 18). */
  protectedCategory?: boolean;
  willingToRelocate?: boolean;
  workMode?: WorkMode;
  workTime?: WorkTime;
  drivingLicense?: DrivingLicenseCategory;
  language?: string;
  minExperienceMonths?: number;
  /** Partecipa a una politica attiva: un programma preciso o `"ANY"` (qualsiasi). */
  activePolicy?: ActivePolicyProgram | "ANY";
  /** Anno di riferimento della politica attiva (insieme al programma, se indicato). */
  activePolicyYear?: number;
  /** Stage della candidatura più recente. */
  stageCodes?: string[];
  recruiterId?: EntityId;
  interviewFrom?: Date;
  interviewTo?: Date;
  withoutInterview?: boolean;
  sort?: CandidateSort;
}

/** Riga della lista candidati con i dati di processo già derivati. */
export interface CandidateListItem {
  id: EntityId;
  firstName: string;
  lastName: string;
  fiscalCode: string | null;
  city: string | null;
  province: string | null;
  employmentStatus: EmploymentStatus;
  protectedCategory: ProtectedCategory;
  availability: AvailabilityType | null;
  createdAt: Date;
  updatedAt: Date;
  /** Candidatura aggiornata più di recente (se esiste). */
  latestApplication: {
    id: EntityId;
    stageCode: string;
    stageLabel: string;
    selectionTitle: string;
    companyName: string;
    recruiter: UserRef | null;
  } | null;
  nextInterviewAt: Date | null;
  lastContactAt: Date | null;
}

/* ------------------------------------------------------------------ */
/* Aggregato profilo                                                    */
/* ------------------------------------------------------------------ */

export interface CandidateAggregate {
  candidate: Candidate;
  profile: CandidateProfile;
  preferences: CandidatePreferences;
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  interests: CandidateInterest[];
  skills: CandidateSkill[];
  languages: CandidateLanguage[];
  certifications: CandidateCertification[];
  drivingLicenses: CandidateDrivingLicense[];
  activePolicies: ActivePolicyParticipation[];
  tags: Tag[];
}

/* ------------------------------------------------------------------ */
/* Scritture                                                            */
/* ------------------------------------------------------------------ */

export interface CandidateIdentityInput {
  firstName: string;
  lastName: string;
  fiscalCode: string | null;
  email: string | null;
  phone: string | null;
  birthDate: ISODate | null;
  gender: Gender;
}

export type CandidateProfileInput = Omit<CandidateProfile, "candidateId" | "lastReviewedAt" | "updatedAt">;
export type CandidatePreferencesInput = Omit<CandidatePreferences, "candidateId" | "updatedAt">;

/** Collezioni del profilo modificabili elemento per elemento. */
export interface CandidateCollections {
  experiences: CandidateExperience;
  education: CandidateEducation;
  interests: CandidateInterest;
  languages: CandidateLanguage;
  certifications: CandidateCertification;
  drivingLicenses: CandidateDrivingLicense;
  activePolicies: ActivePolicyParticipation;
}
export type CandidateCollectionKind = keyof CandidateCollections;
export type CandidateCollectionInput<K extends CandidateCollectionKind> = Omit<
  CandidateCollections[K],
  "id" | "candidateId"
>;

export interface CandidateSkillInput {
  skillName: string;
  category: SkillCategory;
  level: number | null;
  yearsExperience: number | null;
  verified: boolean;
  notes: string | null;
}

export interface CandidateRepository {
  search(query: CandidateSearchQuery): Promise<Page<CandidateListItem>>;
  getById(id: EntityId): Promise<Candidate | null>;
  getAggregate(id: EntityId): Promise<CandidateAggregate | null>;
  findByFiscalCode(fiscalCode: string): Promise<Candidate | null>;

  create(input: CandidateIdentityInput): Promise<Candidate>;
  updateIdentity(id: EntityId, input: CandidateIdentityInput): Promise<Candidate>;
  upsertProfile(id: EntityId, input: CandidateProfileInput, reviewedAt: Date): Promise<CandidateProfile>;
  upsertPreferences(id: EntityId, input: CandidatePreferencesInput): Promise<CandidatePreferences>;
  /** Aggiorna `last_reviewed_at` e `updated_at` del candidato (modifica rilevante). */
  markReviewed(id: EntityId, at: Date): Promise<void>;

  addItem<K extends CandidateCollectionKind>(
    candidateId: EntityId,
    kind: K,
    input: CandidateCollectionInput<K>,
  ): Promise<CandidateCollections[K]>;
  /** Restituisce null se l'elemento non esiste o non appartiene al candidato. */
  updateItem<K extends CandidateCollectionKind>(
    candidateId: EntityId,
    kind: K,
    itemId: EntityId,
    input: CandidateCollectionInput<K>,
  ): Promise<CandidateCollections[K] | null>;
  removeItem(candidateId: EntityId, kind: CandidateCollectionKind, itemId: EntityId): Promise<boolean>;

  setSkill(candidateId: EntityId, input: CandidateSkillInput): Promise<CandidateSkill>;
  removeSkill(candidateId: EntityId, skillId: EntityId): Promise<boolean>;

  /** Candidati per ricerca rapida (es. aggiunta a selezione o talent pool). */
  lookup(text: string, limit: number): Promise<Array<{ id: EntityId; fullName: string; city: string | null }>>;

  /**
   * Candidati compatibili con una posizione: hanno almeno una parola della figura
   * cercata nei dati professionali (profilo, esperienze, competenze, formazione,
   * dati ADV CORE, testo dei CV). Ordinati per parole della figura, poi requisiti.
   */
  matchPosition(query: PositionMatchQuery): Promise<{ total: number; items: PositionMatch[] }>;
}

export interface PositionMatchQuery {
  roleKeywords: string[];
  bonusKeywords: string[];
  /** Selezione di riferimento: segnala chi è già candidato. */
  selectionId: EntityId;
  /** Provincia del luogo di lavoro (sigla): per la vicinanza alla sede. */
  jobProvince?: string | null;
  limit: number;
}

/** Dove è stata trovata la figura cercata, dal dato più affidabile al meno affidabile. */
export type PositionMatchSource = "EXPERIENCE" | "CV" | "INTEREST" | "DETAILS";

export interface PositionMatch {
  candidateId: EntityId;
  firstName: string;
  lastName: string;
  city: string | null;
  province: string | null;
  /** Parole della posizione trovate nei dati del candidato. */
  matchedKeywords: string[];
  /** La figura cercata è il mestiere del candidato (esperienze, settore di esperienza), non solo citata. */
  roleInProfile: boolean;
  /** Fonti in cui compare la figura cercata. */
  roleFoundIn: PositionMatchSource[];
  /** Requisiti della job description trovati nei dati del candidato. */
  matchedRequirements: string[];
  /** Anni di esperienza dichiarati (ADV CORE), null se assenti o non plausibili. */
  experienceYears: number | null;
  /** Settore di esperienza e di interesse dichiarati (testo ADV CORE o esperienze). */
  experienceSector: string | null;
  interestSector: string | null;
  educationLevel: EducationLevel | null;
  drivingLicense: string | null;
  availableToRelocate: boolean | null;
  availableToTravel: boolean | null;
  workMode: string | null;
  employmentStatus: string | null;
  sameProvince: boolean;
  sameRegion: boolean;
  hasCv: boolean;
  hasReadableCv: boolean;
  /** CV più recente (anche se scansionato), per aprirlo dalla lista. */
  cvDocumentId: EntityId | null;
  /** Il CV si può aprire nel browser (PDF o immagine); altrimenti si scarica. */
  cvViewable: boolean;
  alreadyInSelection: boolean;
}

export interface SkillRepository {
  list(): Promise<Skill[]>;
}
