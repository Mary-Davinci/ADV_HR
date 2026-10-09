import { z } from "zod";

import {
  ACTIVE_POLICY_PROGRAMS,
  ACTIVE_POLICY_STATUSES,
  AVAILABILITY_TYPES,
  CONTACT_ACTIONS,
  DRIVING_LICENSE_CATEGORIES,
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  GENDERS,
  LANGUAGE_LEVELS,
  PROTECTED_CATEGORIES,
  SKILL_CATEGORIES,
  WORK_MODES,
  WORK_TIMES,
} from "@/domain";
import type { CandidateCollectionKind } from "@/repositories/types";
import {
  optionalDate,
  optionalEmail,
  optionalEnum,
  optionalFiscalCode,
  optionalInt,
  optionalPhone,
  optionalProvince,
  optionalText,
  requiredDate,
  requiredText,
  triState,
  uuidSchema,
} from "@/lib/zod-helpers";

/* ------------------------------------------------------------------ */
/* Sezioni del profilo                                                  */
/* ------------------------------------------------------------------ */

export const identitySchema = z.object({
  firstName: requiredText(100, "Inserisci il nome"),
  lastName: requiredText(100, "Inserisci il cognome"),
  fiscalCode: optionalFiscalCode,
  email: optionalEmail,
  phone: optionalPhone,
  birthDate: optionalDate.refine(
    (value) => value === null || (value > "1900-01-01" && new Date(value) < new Date()),
    "Data di nascita non valida",
  ),
  gender: z.enum(GENDERS),
});

export const profileSchema = z.object({
  residenceAddress: optionalText(200),
  residenceCity: optionalText(100),
  residenceProvince: optionalProvince,
  residenceRegion: optionalText(60),
  residenceCountry: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Codice paese di 2 lettere (es. IT)")
    .transform((value) => value || null),
  protectedCategory: z.enum(PROTECTED_CATEGORIES),
  protectedCategoryNotes: optionalText(1000),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES),
  professionalSummary: optionalText(4000),
});

export const preferencesSchema = z.object({
  availability: optionalEnum(AVAILABILITY_TYPES),
  desiredEmploymentType: optionalEnum(WORK_TIMES),
  desiredWorkTime: optionalEnum(WORK_TIMES),
  desiredWorkMode: optionalEnum(WORK_MODES),
  willingToRelocate: triState,
  willingToTravel: triState,
  preferredLocations: z
    .string()
    .max(500)
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  availabilityNotes: optionalText(1000),
});

/* ------------------------------------------------------------------ */
/* Collezioni                                                           */
/* ------------------------------------------------------------------ */

export const experienceSchema = z
  .object({
    companyName: requiredText(160, "Inserisci l'azienda"),
    roleTitle: requiredText(160, "Inserisci il ruolo"),
    sector: optionalText(100),
    startDate: requiredDate,
    endDate: optionalDate,
    currentRole: z.boolean(),
    description: optionalText(2000),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: "La data di fine deve seguire quella di inizio",
    path: ["endDate"],
  })
  .transform((value) => ({ ...value, endDate: value.currentRole ? null : value.endDate }));

export const educationSchema = z.object({
  qualification: requiredText(200, "Inserisci il titolo"),
  level: z.enum(EDUCATION_LEVELS),
  fieldOfStudy: optionalText(160),
  institution: optionalText(200),
  year: optionalInt(1950, 2100),
  notes: optionalText(1000),
});

export const interestSchema = z.object({
  sector: requiredText(100, "Inserisci il settore"),
  priority: optionalInt(1, 10),
});

export const languageSchema = z.object({
  language: requiredText(60, "Inserisci la lingua"),
  level: z.enum(LANGUAGE_LEVELS),
  certified: z.boolean(),
  notes: optionalText(500),
});

export const certificationSchema = z
  .object({
    name: requiredText(200, "Inserisci il nome"),
    issuer: optionalText(160),
    issuedAt: optionalDate,
    expiresAt: optionalDate,
    credentialId: optionalText(120),
    notes: optionalText(500),
  })
  .refine((value) => !value.issuedAt || !value.expiresAt || value.expiresAt >= value.issuedAt, {
    message: "La scadenza deve seguire il rilascio",
    path: ["expiresAt"],
  });

export const drivingLicenseSchema = z.object({
  category: z.enum(DRIVING_LICENSE_CATEGORIES),
  valid: z.boolean(),
  notes: optionalText(500),
});

export const activePolicySchema = z.object({
  programType: z.enum(ACTIVE_POLICY_PROGRAMS),
  referenceYear: z.coerce
    .number({ message: "Anno non valido" })
    .int()
    .min(2000, "Anno non valido")
    .max(2100, "Anno non valido"),
  status: optionalEnum(ACTIVE_POLICY_STATUSES),
  notes: optionalText(500),
});

export const COLLECTION_SCHEMAS = {
  experiences: experienceSchema,
  education: educationSchema,
  interests: interestSchema,
  languages: languageSchema,
  certifications: certificationSchema,
  drivingLicenses: drivingLicenseSchema,
  activePolicies: activePolicySchema,
} satisfies Record<CandidateCollectionKind, z.ZodType>;

export const skillSchema = z.object({
  skillName: requiredText(100, "Inserisci la competenza"),
  category: z.enum(SKILL_CATEGORIES),
  level: optionalInt(1, 5),
  yearsExperience: optionalInt(0, 60),
  verified: z.boolean(),
  notes: optionalText(500),
});

export const contactSchema = z.object({
  action: z.enum(CONTACT_ACTIONS),
  note: optionalText(1000),
  applicationId: z.union([z.literal("").transform(() => null), uuidSchema]),
});

/* ------------------------------------------------------------------ */
/* Input delle server action (validati SEMPRE lato server)              */
/* ------------------------------------------------------------------ */

export const COLLECTION_KINDS = [
  "experiences",
  "education",
  "interests",
  "languages",
  "certifications",
  "drivingLicenses",
  "activePolicies",
] as const satisfies readonly CandidateCollectionKind[];

export const candidateIdInput = z.object({ candidateId: uuidSchema });

/** I valori sono validati nell'action con lo schema specifico di `kind` (COLLECTION_SCHEMAS). */
export const collectionItemInput = z.object({
  candidateId: uuidSchema,
  kind: z.enum(COLLECTION_KINDS),
  itemId: uuidSchema.nullable(),
  values: z.unknown(),
});
