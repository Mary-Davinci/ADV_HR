/**
 * DATI COMPLETAMENTE FITTIZI per sviluppo e test.
 * Nessun nome, codice fiscale, azienda o recapito proviene da ADV CORE.
 * Email su dominio riservato `.test` / `.local`, telefoni con prefisso fittizio.
 */
import type {
  ActivePolicyProgram,
  AvailabilityType,
  DrivingLicenseCategory,
  EducationLevel,
  EmploymentStatus,
  EvaluationResult,
  Gender,
  InterviewType,
  LanguageLevel,
  ProtectedCategory,
  RoleCode,
  SelectionStatus,
  SkillCategory,
  WorkMode,
  WorkTime,
} from "@/domain";

export interface SeedUser {
  key: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
  recruiter?: { department: string; phone: string };
}

export const SEED_USERS: SeedUser[] = [
  { key: "admin", email: "admin@adv-hr.local", displayName: "Amministratore ADV", roles: ["ADMIN"] },
  {
    key: "manager",
    email: "laura.conti@adv-hr.local",
    displayName: "Laura Conti",
    roles: ["HR_MANAGER"],
    recruiter: { department: "Ricerca e Selezione", phone: "+39 000 000 0101" },
  },
  {
    key: "chiara",
    email: "chiara.moretti@adv-hr.local",
    displayName: "Chiara Moretti",
    roles: ["RECRUITER"],
    recruiter: { department: "Ricerca e Selezione", phone: "+39 000 000 0102" },
  },
  {
    key: "paolo",
    email: "paolo.esposito@adv-hr.local",
    displayName: "Paolo Esposito",
    roles: ["RECRUITER"],
    recruiter: { department: "Politiche Attive", phone: "+39 000 000 0103" },
  },
  { key: "viewer", email: "consulta@adv-hr.local", displayName: "Utente Consultazione", roles: ["VIEWER"] },
];

export interface SeedCompany {
  key: string;
  name: string;
  sector: string;
  city: string;
  province: string;
  region: string;
}

export const SEED_COMPANIES: SeedCompany[] = [
  {
    key: "meridiane",
    name: "Officine Meridiane S.r.l.",
    sector: "Metalmeccanico",
    city: "Bergamo",
    province: "BG",
    region: "Lombardia",
  },
  {
    key: "padana",
    name: "Logistica Padana S.p.A.",
    sector: "Logistica",
    city: "Piacenza",
    province: "PC",
    region: "Emilia-Romagna",
  },
  {
    key: "verdi",
    name: "Studio Verdi & Associati",
    sector: "Servizi professionali",
    city: "Milano",
    province: "MI",
    region: "Lombardia",
  },
  {
    key: "collina",
    name: "Alimentari Collina S.r.l.",
    sector: "Alimentare",
    city: "Parma",
    province: "PR",
    region: "Emilia-Romagna",
  },
  {
    key: "tecno",
    name: "Tecnoservizi Nord S.r.l.",
    sector: "Informatica",
    city: "Brescia",
    province: "BS",
    region: "Lombardia",
  },
];

export interface SeedSelection {
  key: string;
  company: string;
  title: string;
  status: SelectionStatus;
  openedDaysAgo: number | null;
  closedDaysAgo?: number;
  createdBy: string;
  jd: {
    summary: string;
    duties: string;
    requirements: string;
    workTime: WorkTime;
    workMode: WorkMode;
    salaryMin?: number;
    salaryMax?: number;
    workingHours: string;
    city: string;
    province: string;
    region: string;
  };
}

export const SEED_SELECTIONS: SeedSelection[] = [
  {
    key: "cnc",
    company: "meridiane",
    title: "Operatore CNC – turni",
    status: "OPEN",
    openedDaysAgo: 20,
    createdBy: "manager",
    jd: {
      summary: "Inserimento in reparto produzione su centri di lavoro a controllo numerico.",
      duties:
        "Attrezzaggio e conduzione macchine CNC a 5 assi.\nControllo dimensionale dei pezzi.\nManutenzione ordinaria.",
      requirements: "Esperienza di almeno 2 anni su CNC.\nLettura del disegno tecnico.\nDisponibilità a turni.",
      workTime: "FULL_TIME",
      workMode: "ONSITE",
      salaryMin: 26000,
      salaryMax: 32000,
      workingHours: "Tre turni 6-14 / 14-22 / 22-6",
      city: "Bergamo",
      province: "BG",
      region: "Lombardia",
    },
  },
  {
    key: "manutentore",
    company: "meridiane",
    title: "Manutentore elettromeccanico",
    status: "OPEN",
    openedDaysAgo: 12,
    createdBy: "manager",
    jd: {
      summary: "Manutenzione di linee di produzione e impianti ausiliari.",
      duties: "Interventi di manutenzione preventiva e correttiva.\nDiagnosi guasti elettrici e meccanici.",
      requirements: "Diploma tecnico.\nConoscenza base PLC.\nPatente B.",
      workTime: "FULL_TIME",
      workMode: "ONSITE",
      salaryMin: 28000,
      salaryMax: 34000,
      workingHours: "Giornaliero 8-17",
      city: "Bergamo",
      province: "BG",
      region: "Lombardia",
    },
  },
  {
    key: "magazziniere",
    company: "padana",
    title: "Magazziniere carrellista",
    status: "OPEN",
    openedDaysAgo: 15,
    createdBy: "chiara",
    jd: {
      summary: "Gestione flussi di magazzino in hub logistico.",
      duties: "Carico e scarico merci.\nPicking con terminale WMS.\nInventari periodici.",
      requirements: "Patentino carrellista.\nEsperienza in magazzino.",
      workTime: "EITHER",
      workMode: "ONSITE",
      salaryMin: 22000,
      salaryMax: 25000,
      workingHours: "Turni diurni a rotazione",
      city: "Piacenza",
      province: "PC",
      region: "Emilia-Romagna",
    },
  },
  {
    key: "autista",
    company: "padana",
    title: "Autista patente C + CQC",
    status: "PAUSED",
    openedDaysAgo: 40,
    createdBy: "paolo",
    jd: {
      summary: "Consegne regionali con mezzi pesanti.",
      duties: "Guida mezzi pesanti.\nGestione documenti di trasporto.",
      requirements: "Patente C e CQC merci in corso di validità.",
      workTime: "FULL_TIME",
      workMode: "ONSITE",
      workingHours: "Giornaliero con partenze anticipate",
      city: "Piacenza",
      province: "PC",
      region: "Emilia-Romagna",
    },
  },
  {
    key: "amministrativa",
    company: "verdi",
    title: "Impiegato/a amministrativo/a",
    status: "OPEN",
    openedDaysAgo: 25,
    createdBy: "chiara",
    jd: {
      summary: "Supporto all'area amministrativa di uno studio professionale.",
      duties: "Prima nota e contabilità fornitori.\nRapporti con banche.\nArchiviazione documentale.",
      requirements: "Diploma di ragioneria o laurea economica.\nBuona conoscenza di Excel.",
      workTime: "FULL_TIME",
      workMode: "HYBRID",
      salaryMin: 25000,
      salaryMax: 29000,
      workingHours: "9-13 / 14-18",
      city: "Milano",
      province: "MI",
      region: "Lombardia",
    },
  },
  {
    key: "receptionist",
    company: "verdi",
    title: "Receptionist",
    status: "CLOSED",
    openedDaysAgo: 70,
    closedDaysAgo: 10,
    createdBy: "chiara",
    jd: {
      summary: "Accoglienza clienti e gestione centralino.",
      duties: "Accoglienza.\nGestione agenda e sale riunioni.",
      requirements: "Ottime capacità relazionali.\nInglese B1.",
      workTime: "PART_TIME",
      workMode: "ONSITE",
      workingHours: "Part-time mattina",
      city: "Milano",
      province: "MI",
      region: "Lombardia",
    },
  },
  {
    key: "helpdesk",
    company: "tecno",
    title: "Tecnico helpdesk",
    status: "OPEN",
    openedDaysAgo: 8,
    createdBy: "paolo",
    jd: {
      summary: "Supporto tecnico di primo e secondo livello a clienti aziendali.",
      duties: "Gestione ticket.\nAmministrazione postazioni Windows e Microsoft 365.",
      requirements: "Esperienza helpdesk.\nConoscenza reti di base.\nInglese tecnico.",
      workTime: "FULL_TIME",
      workMode: "HYBRID",
      salaryMin: 27000,
      salaryMax: 31000,
      workingHours: "8:30-17:30",
      city: "Brescia",
      province: "BS",
      region: "Lombardia",
    },
  },
  {
    key: "confezionamento",
    company: "collina",
    title: "Addetti al confezionamento",
    status: "DRAFT",
    openedDaysAgo: null,
    createdBy: "manager",
    jd: {
      summary: "Addetti linea di confezionamento alimentare (bozza).",
      duties: "Confezionamento e controllo qualità visivo.",
      requirements: "Attestato HACCP.",
      workTime: "EITHER",
      workMode: "ONSITE",
      workingHours: "Da definire",
      city: "Parma",
      province: "PR",
      region: "Emilia-Romagna",
    },
  },
];

export interface SeedApplication {
  selection: string;
  stage: string;
  recruiter: string;
  createdDaysAgo: number;
  interview?: { inDays: number; hour: number; minute?: number; type: InterviewType; completed?: boolean };
  feedback?: string;
  evaluation?: { result: EvaluationResult; reason?: string };
  contactDaysAgo?: number;
}

export interface SeedCandidate {
  key: string;
  firstName: string;
  lastName: string;
  fiscalCode: string | null;
  gender: Gender;
  birthDate: string | null;
  city: string;
  province: string;
  region: string;
  employmentStatus: EmploymentStatus;
  protectedCategory?: ProtectedCategory;
  summary: string;
  availability: AvailabilityType;
  workTime: WorkTime;
  workMode: WorkMode;
  relocate: boolean;
  createdDaysAgo: number;
  experiences: Array<{
    company: string;
    role: string;
    sector: string;
    start: string;
    end: string | null;
    description?: string;
  }>;
  education: Array<{
    qualification: string;
    level: EducationLevel;
    year: number;
    institution?: string;
    field?: string;
  }>;
  skills: Array<{ name: string; category: SkillCategory; level: number; years?: number }>;
  languages: Array<{ language: string; level: LanguageLevel; certified?: boolean }>;
  licenses?: DrivingLicenseCategory[];
  policies?: Array<{ program: ActivePolicyProgram; year: number }>;
  interests?: string[];
  applications: SeedApplication[];
}

export const SEED_CANDIDATES: SeedCandidate[] = [
  {
    key: "galli",
    firstName: "Martina",
    lastName: "Galli",
    fiscalCode: "GLLMTN94C52X000A",
    gender: "FEMALE",
    birthDate: "1994-03-12",
    city: "Milano",
    province: "MI",
    region: "Lombardia",
    employmentStatus: "EMPLOYED",
    summary: "Addetta amministrativa con 6 anni di esperienza in PMI manifatturiera.",
    availability: "WITHIN_1_MONTH",
    workTime: "FULL_TIME",
    workMode: "HYBRID",
    relocate: false,
    createdDaysAgo: 9,
    experiences: [
      {
        company: "Meccanica Fittizia S.r.l.",
        role: "Impiegata amministrativa",
        sector: "Metalmeccanico",
        start: "2019-02-01",
        end: null,
        description: "Contabilità fornitori, prima nota, rapporti con banche.",
      },
      {
        company: "Studio Esempio",
        role: "Stagista contabile",
        sector: "Servizi professionali",
        start: "2018-03-01",
        end: "2018-12-31",
      },
    ],
    education: [
      { qualification: "Diploma di ragioneria", level: "UPPER_SECONDARY", year: 2013, institution: "ITC di esempio" },
    ],
    skills: [
      { name: "Excel", category: "DIGITAL", level: 4, years: 6 },
      { name: "Contabilità fornitori", category: "TECHNICAL", level: 4, years: 5 },
      { name: "Precisione", category: "SOFT", level: 5 },
    ],
    languages: [{ language: "Inglese", level: "B1" }],
    licenses: ["B"],
    interests: ["Amministrazione", "Servizi professionali"],
    applications: [
      {
        selection: "amministrativa",
        stage: "INTERVIEW_SCHEDULED",
        recruiter: "chiara",
        createdDaysAgo: 8,
        interview: { inDays: 0, hour: 10, minute: 30, type: "HR" },
        contactDaysAgo: 3,
      },
    ],
  },
  {
    key: "rinaldi",
    firstName: "Davide",
    lastName: "Rinaldi",
    fiscalCode: "RNLDVD89H14X000B",
    gender: "MALE",
    birthDate: "1989-06-14",
    city: "Bergamo",
    province: "BG",
    region: "Lombardia",
    employmentStatus: "UNEMPLOYED",
    summary: "Operatore CNC su centri di lavoro a 5 assi, lettura disegno tecnico e controllo qualità.",
    availability: "IMMEDIATE",
    workTime: "FULL_TIME",
    workMode: "ONSITE",
    relocate: false,
    createdDaysAgo: 5,
    experiences: [
      {
        company: "Torneria Esempio S.n.c.",
        role: "Operatore CNC",
        sector: "Metalmeccanico",
        start: "2014-04-01",
        end: "2025-06-30",
        description: "Conduzione e attrezzaggio centri di lavoro Fanuc.",
      },
    ],
    education: [{ qualification: "Qualifica operatore meccanico", level: "VOCATIONAL", year: 2008 }],
    skills: [
      { name: "CNC Fanuc", category: "TECHNICAL", level: 5, years: 11 },
      { name: "Disegno tecnico", category: "TECHNICAL", level: 4, years: 11 },
      { name: "Controllo qualità", category: "TECHNICAL", level: 3 },
    ],
    languages: [{ language: "Italiano", level: "NATIVE" }],
    licenses: ["B"],
    policies: [{ program: "GOL", year: 2026 }],
    interests: ["Metalmeccanico"],
    applications: [
      {
        selection: "cnc",
        stage: "INTERVIEW_SCHEDULED",
        recruiter: "paolo",
        createdDaysAgo: 5,
        interview: { inDays: 0, hour: 15, type: "TECHNICAL" },
        contactDaysAgo: 2,
      },
    ],
  },
  {
    key: "fontana",
    firstName: "Elisa",
    lastName: "Fontana",
    fiscalCode: "FNTLSE97E61X000C",
    gender: "FEMALE",
    birthDate: "1997-05-21",
    city: "Parma",
    province: "PR",
    region: "Emilia-Romagna",
    employmentStatus: "EMPLOYED",
    protectedCategory: "ART_1",
    summary: "Impiegata back office ufficio acquisti: ordini e anagrafiche fornitori.",
    availability: "WITHIN_2_WEEKS",
    workTime: "FULL_TIME",
    workMode: "HYBRID",
    relocate: false,
    createdDaysAgo: 21,
    experiences: [
      {
        company: "Distribuzione Esempio S.p.A.",
        role: "Impiegata ufficio acquisti",
        sector: "Commercio",
        start: "2022-01-10",
        end: null,
      },
    ],
    education: [{ qualification: "Laurea in Economia aziendale", level: "BACHELOR", year: 2021, field: "Economia" }],
    skills: [
      { name: "SAP", category: "DIGITAL", level: 3, years: 3 },
      { name: "Excel", category: "DIGITAL", level: 4, years: 4 },
      { name: "Comunicazione", category: "SOFT", level: 4 },
    ],
    languages: [
      { language: "Inglese", level: "B2", certified: true },
      { language: "Francese", level: "A2" },
    ],
    licenses: ["B"],
    applications: [
      {
        selection: "amministrativa",
        stage: "SECOND_INTERVIEW",
        recruiter: "chiara",
        createdDaysAgo: 20,
        interview: { inDays: 1, hour: 9, minute: 30, type: "CLIENT" },
        feedback: "Molto precisa, comunicazione chiara. Richiede postazione accessibile.",
        evaluation: { result: "SUITABLE" },
        contactDaysAgo: 1,
      },
    ],
  },
  {
    key: "marchetti",
    firstName: "Andrea",
    lastName: "Marchetti",
    fiscalCode: "MRCNDR92T08X000D",
    gender: "MALE",
    birthDate: "1992-12-08",
    city: "Torino",
    province: "TO",
    region: "Piemonte",
    employmentStatus: "UNEMPLOYED",
    summary: "Magazziniere e carrellista con patentino, gestione WMS e inventari.",
    availability: "IMMEDIATE",
    workTime: "EITHER",
    workMode: "ONSITE",
    relocate: true,
    createdDaysAgo: 4,
    experiences: [
      {
        company: "Hub Logistico Esempio",
        role: "Magazziniere",
        sector: "Logistica",
        start: "2017-05-01",
        end: "2025-09-30",
      },
    ],
    education: [{ qualification: "Licenza media", level: "LOWER_SECONDARY", year: 2006 }],
    skills: [
      { name: "Carrello elevatore", category: "TECHNICAL", level: 5, years: 8 },
      { name: "WMS", category: "DIGITAL", level: 3, years: 5 },
    ],
    languages: [{ language: "Italiano", level: "NATIVE" }],
    licenses: ["B", "FORKLIFT"],
    policies: [{ program: "ASSEGNO_RICOLLOCAZIONE", year: 2025 }],
    applications: [
      {
        selection: "magazziniere",
        stage: "INTERVIEW_SCHEDULED",
        recruiter: "chiara",
        createdDaysAgo: 4,
        interview: { inDays: 2, hour: 11, type: "SCREENING" },
        contactDaysAgo: 2,
      },
    ],
  },
  {
    key: "lombardo",
    firstName: "Francesca",
    lastName: "Lombardo",
    fiscalCode: "LMBFNC99M50X000E",
    gender: "FEMALE",
    birthDate: "1999-08-10",
    city: "Genova",
    province: "GE",
    region: "Liguria",
    employmentStatus: "UNEMPLOYED",
    summary: "Stage in ufficio HR: screening CV, organizzazione colloqui, gestione presenze.",
    availability: "IMMEDIATE",
    workTime: "FULL_TIME",
    workMode: "FLEXIBLE",
    relocate: true,
    createdDaysAgo: 0,
    experiences: [
      {
        company: "Agenzia Esempio",
        role: "Stagista HR",
        sector: "Risorse umane",
        start: "2025-01-15",
        end: "2025-07-15",
      },
    ],
    education: [{ qualification: "Laurea in Psicologia del lavoro", level: "MASTER", year: 2024, field: "Psicologia" }],
    skills: [
      { name: "Screening CV", category: "TECHNICAL", level: 3, years: 1 },
      { name: "Lavoro in team", category: "SOFT", level: 4 },
    ],
    languages: [{ language: "Inglese", level: "C1", certified: true }],
    policies: [{ program: "GARANZIA_GIOVANI", year: 2025 }],
    interests: ["Risorse umane", "Formazione"],
    applications: [],
  },
  {
    key: "barbieri",
    firstName: "Matteo",
    lastName: "Barbieri",
    fiscalCode: "BRBMTT95B17X000F",
    gender: "MALE",
    birthDate: "1995-02-17",
    city: "Brescia",
    province: "BS",
    region: "Lombardia",
    employmentStatus: "EMPLOYED",
    summary: "Tecnico helpdesk di secondo livello, ambienti Windows e Microsoft 365.",
    availability: "WITHIN_1_MONTH",
    workTime: "FULL_TIME",
    workMode: "HYBRID",
    relocate: false,
    createdDaysAgo: 1,
    experiences: [
      {
        company: "IT Service Esempio",
        role: "Tecnico helpdesk",
        sector: "Informatica",
        start: "2020-09-01",
        end: null,
      },
    ],
    education: [{ qualification: "Diploma perito informatico", level: "UPPER_SECONDARY", year: 2014 }],
    skills: [
      { name: "Microsoft 365", category: "DIGITAL", level: 4, years: 5 },
      { name: "Active Directory", category: "TECHNICAL", level: 3, years: 4 },
      { name: "Reti TCP/IP", category: "TECHNICAL", level: 3 },
    ],
    languages: [{ language: "Inglese", level: "B2" }],
    licenses: ["B"],
    applications: [{ selection: "helpdesk", stage: "TO_REVIEW", recruiter: "paolo", createdDaysAgo: 1 }],
  },
  {
    key: "ferri",
    firstName: "Giorgia",
    lastName: "Ferri",
    fiscalCode: "FRRGRG91S55X000G",
    gender: "FEMALE",
    birthDate: "1991-11-15",
    city: "Napoli",
    province: "NA",
    region: "Campania",
    employmentStatus: "EMPLOYED",
    summary: "Responsabile turni in GDO, coordinamento di 12 addetti, gestione ordini reparto.",
    availability: "OVER_1_MONTH",
    workTime: "FULL_TIME",
    workMode: "ONSITE",
    relocate: true,
    createdDaysAgo: 18,
    experiences: [
      {
        company: "Supermercati Esempio",
        role: "Capo turno",
        sector: "Grande distribuzione",
        start: "2016-03-01",
        end: null,
      },
    ],
    education: [{ qualification: "Diploma tecnico commerciale", level: "UPPER_SECONDARY", year: 2010 }],
    skills: [
      { name: "Gestione del personale", category: "SOFT", level: 4, years: 6 },
      { name: "Gestione ordini", category: "TECHNICAL", level: 4 },
    ],
    languages: [{ language: "Inglese", level: "A2" }],
    licenses: ["B"],
    applications: [
      {
        selection: "magazziniere",
        stage: "INTERVIEWED",
        recruiter: "chiara",
        createdDaysAgo: 14,
        interview: { inDays: -3, hour: 14, type: "HR", completed: true },
        feedback: "Esperienza di coordinamento rilevante. Valutare disponibilità al trasferimento.",
        evaluation: { result: "TO_REVIEW" },
        contactDaysAgo: 3,
      },
    ],
  },
  {
    key: "caruso",
    firstName: "Simone",
    lastName: "Caruso",
    fiscalCode: "CRSSMN88A23X000H",
    gender: "MALE",
    birthDate: "1988-01-23",
    city: "Piacenza",
    province: "PC",
    region: "Emilia-Romagna",
    employmentStatus: "UNEMPLOYED",
    summary: "Autista patente C+CQC, consegne regionali, utilizzo palmare di tracciamento.",
    availability: "IMMEDIATE",
    workTime: "FULL_TIME",
    workMode: "ONSITE",
    relocate: false,
    createdDaysAgo: 6,
    experiences: [
      {
        company: "Trasporti Esempio",
        role: "Autista mezzi pesanti",
        sector: "Logistica",
        start: "2012-06-01",
        end: "2025-08-31",
      },
    ],
    education: [{ qualification: "Licenza media", level: "LOWER_SECONDARY", year: 2003 }],
    skills: [{ name: "Guida mezzi pesanti", category: "TECHNICAL", level: 5, years: 13 }],
    languages: [{ language: "Italiano", level: "NATIVE" }],
    licenses: ["B", "C", "CE", "CQC_GOODS"],
    applications: [
      { selection: "autista", stage: "CONTACTED", recruiter: "paolo", createdDaysAgo: 6, contactDaysAgo: 5 },
    ],
  },
  {
    key: "mancini",
    firstName: "Chiara",
    lastName: "Mancini",
    fiscalCode: "MNCCHR96D44X000J",
    gender: "FEMALE",
    birthDate: "1996-04-04",
    city: "Milano",
    province: "MI",
    region: "Lombardia",
    employmentStatus: "EMPLOYED",
    protectedCategory: "ART_18",
    summary: "Receptionist e segreteria in studio professionale, gestione agenda e centralino.",
    availability: "WITHIN_2_WEEKS",
    workTime: "PART_TIME",
    workMode: "ONSITE",
    relocate: false,
    createdDaysAgo: 60,
    experiences: [
      {
        company: "Studio Legale Esempio",
        role: "Receptionist",
        sector: "Servizi professionali",
        start: "2019-10-01",
        end: null,
      },
    ],
    education: [{ qualification: "Diploma linguistico", level: "UPPER_SECONDARY", year: 2015 }],
    skills: [
      { name: "Accoglienza clienti", category: "SOFT", level: 5 },
      { name: "Gestione agenda", category: "TECHNICAL", level: 4 },
    ],
    languages: [
      { language: "Inglese", level: "B2" },
      { language: "Spagnolo", level: "B1" },
    ],
    applications: [
      {
        selection: "receptionist",
        stage: "SELECTED",
        recruiter: "chiara",
        createdDaysAgo: 55,
        interview: { inDays: -20, hour: 10, type: "CLIENT", completed: true },
        feedback: "Ottima presenza e cortesia. Confermata idoneità per il front office.",
        evaluation: { result: "SUITABLE" },
        contactDaysAgo: 12,
      },
    ],
  },
  {
    key: "gatti",
    firstName: "Lorenzo",
    lastName: "Gatti",
    fiscalCode: "GTTLNZ93L19X000K",
    gender: "MALE",
    birthDate: "1993-07-19",
    city: "Brescia",
    province: "BS",
    region: "Lombardia",
    employmentStatus: "EMPLOYED",
    summary: "Manutentore elettromeccanico su linee di confezionamento, PLC base.",
    availability: "WITHIN_1_MONTH",
    workTime: "FULL_TIME",
    workMode: "ONSITE",
    relocate: false,
    createdDaysAgo: 7,
    experiences: [
      {
        company: "Packaging Esempio S.r.l.",
        role: "Manutentore",
        sector: "Metalmeccanico",
        start: "2017-02-01",
        end: null,
      },
    ],
    education: [{ qualification: "Diploma perito elettrotecnico", level: "UPPER_SECONDARY", year: 2012 }],
    skills: [
      { name: "PLC Siemens", category: "TECHNICAL", level: 3, years: 4 },
      { name: "Manutenzione elettrica", category: "TECHNICAL", level: 4, years: 8 },
    ],
    languages: [{ language: "Inglese", level: "A2" }],
    licenses: ["B"],
    applications: [
      {
        selection: "manutentore",
        stage: "INTERVIEW_SCHEDULED",
        recruiter: "paolo",
        createdDaysAgo: 7,
        interview: { inDays: 4, hour: 14, minute: 30, type: "TECHNICAL" },
        contactDaysAgo: 4,
      },
    ],
  },
  {
    key: "rizzi",
    firstName: "Valentina",
    lastName: "Rizzi",
    fiscalCode: "RZZVNT90P63X000L",
    gender: "FEMALE",
    birthDate: "1990-09-23",
    city: "Venezia",
    province: "VE",
    region: "Veneto",
    employmentStatus: "EMPLOYED",
    summary: "Contabile senior: bilanci, adempimenti fiscali, rapporti con consulente del lavoro.",
    availability: "OVER_1_MONTH",
    workTime: "FULL_TIME",
    workMode: "REMOTE",
    relocate: false,
    createdDaysAgo: 25,
    experiences: [
      {
        company: "Commercialisti Esempio",
        role: "Contabile senior",
        sector: "Servizi professionali",
        start: "2014-01-01",
        end: null,
      },
    ],
    education: [{ qualification: "Laurea magistrale in Economia", level: "MASTER", year: 2013 }],
    skills: [
      { name: "Bilancio", category: "TECHNICAL", level: 5, years: 10 },
      { name: "Excel", category: "DIGITAL", level: 5, years: 12 },
    ],
    languages: [{ language: "Inglese", level: "C1" }],
    applications: [
      {
        selection: "amministrativa",
        stage: "REJECTED",
        recruiter: "chiara",
        createdDaysAgo: 24,
        interview: { inDays: -15, hour: 11, type: "HR", completed: true },
        feedback: "Competenze superiori a quanto richiesto; aspettative economiche fuori budget.",
        evaluation: {
          result: "NOT_SUITABLE",
          reason: "Aspettative economiche non compatibili con il budget della posizione.",
        },
        contactDaysAgo: 14,
      },
    ],
  },
  {
    key: "longo",
    firstName: "Alessandro",
    lastName: "Longo",
    fiscalCode: "LNGLSN98R05X000M",
    gender: "MALE",
    birthDate: "1998-10-05",
    city: "Piacenza",
    province: "PC",
    region: "Emilia-Romagna",
    employmentStatus: "UNEMPLOYED",
    summary: "Addetto vendite in negozio di elettronica, cassa e allestimento.",
    availability: "IMMEDIATE",
    workTime: "EITHER",
    workMode: "ONSITE",
    relocate: false,
    createdDaysAgo: 0,
    experiences: [
      {
        company: "Elettronica Esempio",
        role: "Addetto vendite",
        sector: "Commercio",
        start: "2021-04-01",
        end: "2025-03-31",
      },
    ],
    education: [{ qualification: "Diploma professionale commercio", level: "UPPER_SECONDARY", year: 2017 }],
    skills: [{ name: "Vendita assistita", category: "SOFT", level: 4, years: 4 }],
    languages: [{ language: "Inglese", level: "A2" }],
    licenses: ["B"],
    policies: [{ program: "GOL", year: 2026 }],
    applications: [{ selection: "magazziniere", stage: "NEW", recruiter: "chiara", createdDaysAgo: 0 }],
  },
  {
    key: "testa",
    firstName: "Sofia",
    lastName: "Testa",
    fiscalCode: null,
    gender: "NOT_SPECIFIED",
    birthDate: "2000-02-29",
    city: "Verona",
    province: "VR",
    region: "Veneto",
    employmentStatus: "UNKNOWN",
    summary: "Candidatura spontanea ricevuta via email, CV incompleto.",
    availability: "WITHIN_2_WEEKS",
    workTime: "PART_TIME",
    workMode: "FLEXIBLE",
    relocate: false,
    createdDaysAgo: 2,
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    applications: [{ selection: "amministrativa", stage: "TO_REVIEW", recruiter: "chiara", createdDaysAgo: 2 }],
  },
  {
    key: "pellegrini",
    firstName: "Riccardo",
    lastName: "Pellegrini",
    fiscalCode: "PLLRCR87C11X000N",
    gender: "MALE",
    birthDate: "1987-03-11",
    city: "Pisa",
    province: "PI",
    region: "Toscana",
    employmentStatus: "EMPLOYED",
    summary: "Responsabile di magazzino, gestione team di 8 persone, ottimizzazione flussi.",
    availability: "WITHIN_1_MONTH",
    workTime: "FULL_TIME",
    workMode: "ONSITE",
    relocate: true,
    createdDaysAgo: 40,
    experiences: [
      {
        company: "Deposito Esempio",
        role: "Responsabile magazzino",
        sector: "Logistica",
        start: "2015-09-01",
        end: null,
      },
      { company: "Hub Esempio", role: "Magazziniere", sector: "Logistica", start: "2010-01-01", end: "2015-08-31" },
    ],
    education: [{ qualification: "Diploma tecnico", level: "UPPER_SECONDARY", year: 2006 }],
    skills: [
      { name: "Gestione del personale", category: "SOFT", level: 4, years: 9 },
      { name: "WMS", category: "DIGITAL", level: 4, years: 9 },
    ],
    languages: [{ language: "Inglese", level: "B1" }],
    licenses: ["B", "FORKLIFT"],
    applications: [
      {
        selection: "magazziniere",
        stage: "ON_HOLD",
        recruiter: "chiara",
        createdDaysAgo: 13,
        feedback: "In attesa di riscontro dall'azienda cliente sul livello di inquadramento.",
        contactDaysAgo: 6,
      },
    ],
  },
  {
    key: "cattaneo",
    firstName: "Beatrice",
    lastName: "Cattaneo",
    fiscalCode: "CTTBTR95H42X000P",
    gender: "FEMALE",
    birthDate: "1995-06-02",
    city: "Lecco",
    province: "LC",
    region: "Lombardia",
    employmentStatus: "EMPLOYED",
    summary: "Disegnatrice tecnica CAD 2D/3D, SolidWorks, documentazione di prodotto.",
    availability: "WITHIN_1_MONTH",
    workTime: "FULL_TIME",
    workMode: "HYBRID",
    relocate: false,
    createdDaysAgo: 3,
    experiences: [
      {
        company: "Progetti Esempio S.r.l.",
        role: "Disegnatrice tecnica",
        sector: "Metalmeccanico",
        start: "2019-05-01",
        end: null,
      },
    ],
    education: [{ qualification: "Laurea in Ingegneria meccanica", level: "BACHELOR", year: 2018 }],
    skills: [
      { name: "SolidWorks", category: "DIGITAL", level: 4, years: 6 },
      { name: "Disegno tecnico", category: "TECHNICAL", level: 5, years: 6 },
    ],
    languages: [{ language: "Inglese", level: "B2" }],
    licenses: ["B"],
    applications: [
      {
        selection: "cnc",
        stage: "INTERVIEW_SCHEDULED",
        recruiter: "paolo",
        createdDaysAgo: 3,
        interview: { inDays: 6, hour: 10, type: "HR" },
        contactDaysAgo: 1,
      },
    ],
  },
  {
    key: "serra",
    firstName: "Tommaso",
    lastName: "Serra",
    fiscalCode: "SRRTMS94E30X000Q",
    gender: "MALE",
    birthDate: "1994-05-30",
    city: "Brescia",
    province: "BS",
    region: "Lombardia",
    employmentStatus: "EMPLOYED",
    summary: "Sviluppatore gestionali web, PHP e JavaScript, supporto utenti interni.",
    availability: "WITHIN_2_WEEKS",
    workTime: "FULL_TIME",
    workMode: "REMOTE",
    relocate: false,
    createdDaysAgo: 8,
    experiences: [
      { company: "Software Esempio", role: "Sviluppatore web", sector: "Informatica", start: "2018-10-01", end: null },
    ],
    education: [{ qualification: "Laurea in Informatica", level: "BACHELOR", year: 2017 }],
    skills: [
      { name: "PHP", category: "TECHNICAL", level: 4, years: 7 },
      { name: "JavaScript", category: "TECHNICAL", level: 4, years: 6 },
      { name: "Microsoft 365", category: "DIGITAL", level: 3 },
    ],
    languages: [{ language: "Inglese", level: "B2" }],
    applications: [
      {
        selection: "helpdesk",
        stage: "CONTACTED",
        recruiter: "paolo",
        createdDaysAgo: 7,
        contactDaysAgo: 2,
        evaluation: { result: "TO_REVIEW" },
      },
    ],
  },
  {
    key: "villa",
    firstName: "Irene",
    lastName: "Villa",
    fiscalCode: "VLLRNI92A41X000R",
    gender: "FEMALE",
    birthDate: "1992-01-01",
    city: "Monza",
    province: "MB",
    region: "Lombardia",
    employmentStatus: "UNEMPLOYED",
    summary: "Assistente di direzione, organizzazione trasferte ed eventi aziendali.",
    availability: "IMMEDIATE",
    workTime: "FULL_TIME",
    workMode: "HYBRID",
    relocate: false,
    createdDaysAgo: 12,
    experiences: [
      {
        company: "Holding Esempio",
        role: "Assistente di direzione",
        sector: "Servizi",
        start: "2016-01-01",
        end: "2025-12-31",
      },
    ],
    education: [{ qualification: "Laurea in Lingue", level: "BACHELOR", year: 2015 }],
    skills: [
      { name: "Organizzazione eventi", category: "SOFT", level: 4 },
      { name: "Excel", category: "DIGITAL", level: 3 },
    ],
    languages: [
      { language: "Inglese", level: "C1", certified: true },
      { language: "Tedesco", level: "B1" },
    ],
    licenses: ["B"],
    applications: [
      {
        selection: "amministrativa",
        stage: "INTERVIEWED",
        recruiter: "chiara",
        createdDaysAgo: 11,
        interview: { inDays: -2, hour: 16, type: "HR", completed: true },
        feedback: "Colloquio positivo, buone referenze. Proposta per secondo colloquio con il cliente.",
        evaluation: { result: "SUITABLE" },
        contactDaysAgo: 2,
      },
    ],
  },
  {
    key: "deluca",
    firstName: "Nicolò",
    lastName: "De Luca",
    fiscalCode: "DLCNCL97T12X000S",
    gender: "MALE",
    birthDate: "1997-12-12",
    city: "Reggio Emilia",
    province: "RE",
    region: "Emilia-Romagna",
    employmentStatus: "INACTIVE",
    summary: "Operaio addetto al confezionamento alimentare, attestato HACCP.",
    availability: "IMMEDIATE",
    workTime: "EITHER",
    workMode: "ONSITE",
    relocate: false,
    createdDaysAgo: 5,
    experiences: [
      {
        company: "Conserve Esempio",
        role: "Addetto confezionamento",
        sector: "Alimentare",
        start: "2020-03-01",
        end: "2024-11-30",
      },
    ],
    education: [{ qualification: "Qualifica operatore agroalimentare", level: "VOCATIONAL", year: 2016 }],
    skills: [{ name: "HACCP", category: "TECHNICAL", level: 3, years: 4 }],
    languages: [{ language: "Italiano", level: "NATIVE" }],
    licenses: ["B"],
    policies: [{ program: "DOTE_UNICA_LAVORO", year: 2025 }],
    interests: ["Alimentare"],
    applications: [
      {
        selection: "magazziniere",
        stage: "INTERVIEW_SCHEDULED",
        recruiter: "chiara",
        createdDaysAgo: 5,
        interview: { inDays: 3, hour: 16, type: "SCREENING" },
        contactDaysAgo: 3,
      },
    ],
  },
];

export const SEED_TALENT_POOLS = [
  {
    name: "Logistica – profili operativi",
    description: "Magazzinieri, carrellisti e autisti disponibili per nuove selezioni.",
    members: ["marchetti", "caruso", "pellegrini"],
  },
  {
    name: "Amministrazione e segreteria",
    description: "Profili amministrativi e di front office.",
    members: ["galli", "mancini", "villa"],
  },
];

export const SEED_TASKS = [
  {
    title: "Richiamare per disponibilità turni",
    assignee: "chiara",
    candidate: "marchetti",
    dueInDays: 1,
    priority: "HIGH" as const,
  },
  {
    title: "Raccogliere referenze",
    assignee: "chiara",
    candidate: "villa",
    dueInDays: -1,
    priority: "MEDIUM" as const,
  },
  {
    title: "Inviare job description aggiornata al cliente",
    assignee: "paolo",
    selection: "helpdesk",
    dueInDays: 2,
    priority: "MEDIUM" as const,
  },
  {
    title: "Verificare validità CQC",
    assignee: "paolo",
    candidate: "caruso",
    dueInDays: -2,
    priority: "HIGH" as const,
  },
  {
    title: "Revisionare CV candidature nuove",
    assignee: "chiara",
    selection: "amministrativa",
    dueInDays: 0,
    priority: "LOW" as const,
  },
  { title: "Preparare report settimanale selezioni", assignee: "manager", dueInDays: 4, priority: "LOW" as const },
];

export const SEED_TAGS = [
  { name: "Disponibile subito", slug: "disponibile-subito", candidates: ["rinaldi", "marchetti", "caruso", "longo"] },
  { name: "Da ricontattare", slug: "da-ricontattare", candidates: ["pellegrini", "ferri"] },
];
