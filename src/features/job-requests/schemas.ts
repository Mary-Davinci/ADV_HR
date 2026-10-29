import { z } from "zod";

import {
  EXPERIENCE_LEVELS,
  HIRING_DOCUMENTS,
  HIRING_INCENTIVES,
  isValidVatNumber,
  JOB_CONTRACT_TYPES,
  WORK_DAYS,
  type JobRequestForm,
  type JobRequestFormValues,
} from "@/domain";
import { FISCAL_CODE_PATTERN as PERSON_FISCAL_CODE, uuidSchema } from "@/lib/zod-helpers";

/**
 * Lunghezze massime dei campi: dimensionate sullo spazio disponibile nel
 * modulo PDF ufficiale. Il generatore del PDF verifica comunque che ogni
 * testo entri davvero nel suo riquadro.
 */
export const FIELD_LIMITS = {
  name: 60,
  vatOrFiscalCode: 16,
  registeredOffice: 130,
  operatingOffice: 130,
  phone: 30,
  adminEmail: 60,
  pec: 80,
  sdiCode: 7,
  contactName: 90,
  contactEmail: 60,
  contactPhone: 30,
  role: 75,
  city: 30,
  duties: 110,
  activities: 100,
  education: 95,
  drivingLicense: 20,
  certifications: 120,
  mandatoryRequirements: 110,
  otherType: 60,
  ccnl: 35,
  level: 50,
  monthlySalary: 100,
  annualSalary: 120,
  benefits: 130,
  smartWorkingDays: 50,
  incentiveOther: 40,
  expectedHireMonth: 100,
  incentiveNotes: 250,
  documentOther: 60,
  companyNotes: 600,
  signatoryName: 60,
} as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ */
/* Valori grezzi (bozza): forma e lunghezze, nessun campo obbligatorio  */
/* ------------------------------------------------------------------ */

const text = (max: number) => z.string().max(max, `Massimo ${max} caratteri`);
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.literal(""), z.enum(values)]);
const yesNo = z.enum(["true", "false", ""]);

export const jobRequestValuesSchema = z.object({
  company: z.object({
    name: text(FIELD_LIMITS.name),
    vatOrFiscalCode: text(20),
    registeredOffice: text(FIELD_LIMITS.registeredOffice),
    operatingOffice: text(FIELD_LIMITS.operatingOffice),
    phone: text(FIELD_LIMITS.phone),
    adminEmail: text(FIELD_LIMITS.adminEmail),
    pec: text(FIELD_LIMITS.pec),
    sdiCode: text(10),
    contactName: text(FIELD_LIMITS.contactName),
    contactEmail: text(FIELD_LIMITS.contactEmail),
    contactPhone: text(FIELD_LIMITS.contactPhone),
  }),
  profile: z.object({
    role: text(FIELD_LIMITS.role),
    positions: text(4),
    experience: choice(EXPERIENCE_LEVELS),
    city: text(FIELD_LIMITS.city),
    province: text(2),
    travel: yesNo,
    duties: text(FIELD_LIMITS.duties),
    activities: text(FIELD_LIMITS.activities),
    education: text(FIELD_LIMITS.education),
    drivingLicense: text(FIELD_LIMITS.drivingLicense),
    certifications: text(FIELD_LIMITS.certifications),
    mandatoryRequirements: text(FIELD_LIMITS.mandatoryRequirements),
    expectedHireDate: text(10),
  }),
  contract: z.object({
    type: choice(JOB_CONTRACT_TYPES),
    fixedTermMonths: text(3),
    otherType: text(FIELD_LIMITS.otherType),
    ccnl: text(FIELD_LIMITS.ccnl),
    level: text(FIELD_LIMITS.level),
    monthlySalary: text(FIELD_LIMITS.monthlySalary),
    annualSalary: text(FIELD_LIMITS.annualSalary),
    benefits: text(FIELD_LIMITS.benefits),
    schedule: z.enum(["FULL", "PART", ""]),
    from: text(5),
    to: text(5),
    weeklyHours: text(3),
    days: z.array(z.enum(WORK_DAYS)).max(WORK_DAYS.length),
    holidayWork: yesNo,
    onSite: z.boolean(),
    smartWorking: z.boolean(),
    smartWorkingDays: text(FIELD_LIMITS.smartWorkingDays),
  }),
  incentives: z.object({
    types: z.array(z.enum(HIRING_INCENTIVES)).max(HIRING_INCENTIVES.length),
    other: text(FIELD_LIMITS.incentiveOther),
    expectedHireMonth: text(FIELD_LIMITS.expectedHireMonth),
    notes: text(FIELD_LIMITS.incentiveNotes),
  }),
  documents: z.object({
    required: z.array(z.enum(HIRING_DOCUMENTS)).max(HIRING_DOCUMENTS.length),
    other: text(FIELD_LIMITS.documentOther),
  }),
  companyNotes: text(FIELD_LIMITS.companyNotes),
  consent: z.object({
    signatoryName: text(FIELD_LIMITS.signatoryName),
    granted: z.boolean(),
  }),
}) satisfies z.ZodType<JobRequestFormValues>;

/* ------------------------------------------------------------------ */
/* Modulo completo: tutte le regole, produce il JobRequestForm          */
/* ------------------------------------------------------------------ */

const required = (max: number, message = "Campo obbligatorio") =>
  z.string().trim().min(1, message).max(max, `Massimo ${max} caratteri`);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Massimo ${max} caratteri`)
    .transform((value) => value || null);
const email = (max: number, message = "Email non valida") =>
  z.string().trim().toLowerCase().max(max, `Massimo ${max} caratteri`).pipe(z.email(message));
const phone = (max: number) => required(max).regex(/^\+?[\d\s().-]{6,}$/, "Numero di telefono non valido");
const integer = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));
const boolean = (message: string) => z.enum(["true", "false"], { message }).transform((value) => value === "true");

/** Codice fiscale di un'azienda (= P.IVA, 11 cifre) o di una ditta individuale (16 caratteri). */
const vatOrFiscalCode = z
  .string()
  .transform((value) =>
    value
      .replace(/\s+/g, "")
      .toUpperCase()
      .replace(/^IT(?=\d{11}$)/, ""),
  )
  .refine(
    (value) => (/^\d{11}$/.test(value) ? isValidVatNumber(value) : PERSON_FISCAL_CODE.test(value)),
    "Partita IVA o codice fiscale non valido",
  );

export const jobRequestFormSchema = z
  .object({
    company: z.object({
      name: required(FIELD_LIMITS.name, "Inserisci la ragione sociale"),
      vatOrFiscalCode,
      registeredOffice: required(FIELD_LIMITS.registeredOffice, "Inserisci la sede legale"),
      operatingOffice: optional(FIELD_LIMITS.operatingOffice),
      phone: phone(FIELD_LIMITS.phone),
      adminEmail: email(FIELD_LIMITS.adminEmail),
      pec: email(FIELD_LIMITS.pec, "PEC non valida"),
      sdiCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{7}$/, "Il codice SDI ha 7 caratteri (lettere e cifre)"),
      contactName: required(FIELD_LIMITS.contactName, "Inserisci il referente della selezione"),
      contactEmail: email(FIELD_LIMITS.contactEmail),
      contactPhone: phone(FIELD_LIMITS.contactPhone),
    }),
    profile: z.object({
      role: required(FIELD_LIMITS.role, "Inserisci il ruolo"),
      positions: integer(1, 999, "Numero di lavoratori non valido (1-999)"),
      experience: z.enum(EXPERIENCE_LEVELS, { message: "Indica l'esperienza richiesta" }),
      city: required(FIELD_LIMITS.city, "Inserisci la città del luogo di lavoro"),
      province: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, "Sigla provincia di 2 lettere"),
      travel: boolean("Indica la disponibilità a trasferte"),
      duties: required(FIELD_LIMITS.duties, "Inserisci il mansionario sintetico"),
      activities: required(FIELD_LIMITS.activities, "Inserisci la descrizione delle attività"),
      education: optional(FIELD_LIMITS.education),
      drivingLicense: optional(FIELD_LIMITS.drivingLicense),
      certifications: optional(FIELD_LIMITS.certifications),
      mandatoryRequirements: optional(FIELD_LIMITS.mandatoryRequirements),
      expectedHireDate: z
        .string()
        .trim()
        .refine((value) => value === "" || isRealDate(value), "Data non valida")
        .transform((value) => value || null),
    }),
    contract: z.object({
      type: z.enum(JOB_CONTRACT_TYPES, { message: "Indica la tipologia di contratto" }),
      fixedTermMonths: z.string().trim(),
      otherType: optional(FIELD_LIMITS.otherType),
      ccnl: optional(FIELD_LIMITS.ccnl),
      level: optional(FIELD_LIMITS.level),
      monthlySalary: optional(FIELD_LIMITS.monthlySalary),
      annualSalary: optional(FIELD_LIMITS.annualSalary),
      benefits: optional(FIELD_LIMITS.benefits),
      schedule: z.enum(["FULL", "PART"], { message: "Indica tempo pieno o parziale" }),
      from: z.string().regex(TIME, "Orario non valido (hh:mm)"),
      to: z.string().regex(TIME, "Orario non valido (hh:mm)"),
      weeklyHours: integer(1, 48, "Ore settimanali non valide (1-48)"),
      days: z.array(z.enum(WORK_DAYS)).min(1, "Seleziona almeno un giorno lavorativo"),
      holidayWork: boolean("Indica se è previsto lavoro festivo"),
      onSite: z.boolean(),
      smartWorking: z.boolean(),
      smartWorkingDays: optional(FIELD_LIMITS.smartWorkingDays),
    }),
    incentives: z.object({
      types: z.array(z.enum(HIRING_INCENTIVES)),
      other: optional(FIELD_LIMITS.incentiveOther),
      expectedHireMonth: optional(FIELD_LIMITS.expectedHireMonth),
      notes: optional(FIELD_LIMITS.incentiveNotes),
    }),
    documents: z.object({
      required: z.array(z.enum(HIRING_DOCUMENTS)),
      other: optional(FIELD_LIMITS.documentOther),
    }),
    companyNotes: optional(FIELD_LIMITS.companyNotes),
    consent: z.object({
      signatoryName: required(FIELD_LIMITS.signatoryName, "Inserisci il nome del legale rappresentante"),
      granted: z.literal(true, { message: "Senza consenso al trattamento dei dati la richiesta non è valida" }),
    }),
  })
  .superRefine((form, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const { contract, incentives, documents } = form;

    if (contract.type === "FIXED_TERM") {
      const months = Number(contract.fixedTermMonths);
      if (!/^\d+$/.test(contract.fixedTermMonths) || months < 1 || months > 60) {
        issue(["contract", "fixedTermMonths"], "Durata in mesi non valida (1-60)");
      }
    }
    if (contract.type === "OTHER" && !contract.otherType) {
      issue(["contract", "otherType"], "Specifica la tipologia di contratto");
    }
    if (contract.from >= contract.to) issue(["contract", "to"], "L'orario di fine deve seguire quello di inizio");
    if (!contract.onSite && !contract.smartWorking) {
      issue(["contract", "onSite"], "Indica se il lavoro è in azienda, in smart working o entrambi");
    }
    if (contract.smartWorking && !contract.smartWorkingDays) {
      issue(["contract", "smartWorkingDays"], "Indica i giorni di smart working");
    }
    if (incentives.types.includes("OTHER") && !incentives.other) {
      issue(["incentives", "other"], "Specifica l'altra agevolazione");
    }
    if (documents.required.includes("OTHER") && !documents.other) {
      issue(["documents", "other"], "Specifica l'altro documento");
    }
  })
  .transform((form): JobRequestForm => ({
    ...form,
    contract: {
      type: form.contract.type,
      fixedTermMonths: form.contract.type === "FIXED_TERM" ? Number(form.contract.fixedTermMonths) : null,
      otherType: form.contract.type === "OTHER" ? form.contract.otherType : null,
      ccnl: form.contract.ccnl,
      level: form.contract.level,
      monthlySalary: form.contract.monthlySalary,
      annualSalary: form.contract.annualSalary,
      benefits: form.contract.benefits,
      fullTime: form.contract.schedule === "FULL",
      from: form.contract.from,
      to: form.contract.to,
      weeklyHours: form.contract.weeklyHours,
      days: WORK_DAYS.filter((day) => form.contract.days.includes(day)),
      holidayWork: form.contract.holidayWork,
      onSite: form.contract.onSite,
      smartWorking: form.contract.smartWorking,
      smartWorkingDays: form.contract.smartWorking ? form.contract.smartWorkingDays : null,
    },
    incentives: {
      ...form.incentives,
      other: form.incentives.types.includes("OTHER") ? form.incentives.other : null,
    },
    documents: {
      ...form.documents,
      other: form.documents.required.includes("OTHER") ? form.documents.other : null,
    },
  }));

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/* ------------------------------------------------------------------ */
/* Input delle server action                                            */
/* ------------------------------------------------------------------ */

export const saveJobRequestSchema = z.object({ requestId: uuidSchema, values: jobRequestValuesSchema });
export const requestIdSchema = z.object({ requestId: uuidSchema });
export const reviewNoteSchema = z.object({
  requestId: uuidSchema,
  note: z.string().trim().min(1, "Indica cosa va corretto").max(1000, "Massimo 1000 caratteri"),
});
export const createAndSendJobRequestSchema = z.object({
  companyId: uuidSchema,
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Inserisci un'email valida")),
});

export const sendJobRequestSchema = z.object({
  requestId: uuidSchema,
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Inserisci un'email valida")),
});

/* ------------------------------------------------------------------ */
/* Link pubblico dell'azienda                                           */
/* ------------------------------------------------------------------ */

export const accessTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Link non valido");
export const publicSaveSchema = z.object({ token: accessTokenSchema, values: jobRequestValuesSchema });
