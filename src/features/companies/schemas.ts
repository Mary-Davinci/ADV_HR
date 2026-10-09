import { z } from "zod";

import { SELECTION_STATUSES, WORK_MODES, WORK_TIMES } from "@/domain";
import {
  optionalDate,
  optionalEmail,
  optionalEnum,
  optionalMoney,
  optionalPhone,
  optionalProvince,
  optionalText,
  requiredText,
  uuidSchema,
} from "@/lib/zod-helpers";

export const companySchema = z.object({
  name: requiredText(200, "Inserisci la ragione sociale"),
  vatNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || /^(IT)?\d{11}$/.test(value), "Partita IVA non valida (11 cifre)")
    .transform((value) => value.replace(/^IT/, "") || null),
  fiscalCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || /^[A-Z0-9]{11,16}$/.test(value), "Codice fiscale non valido")
    .transform((value) => value || null),
  sector: optionalText(100),
  city: optionalText(100),
  province: optionalProvince,
  region: optionalText(60),
  email: optionalEmail,
  phone: optionalPhone,
  notes: optionalText(2000),
});

const toStartOfDay = (value: string | null) => (value ? new Date(`${value}T09:00:00`) : null);

export const selectionSchema = z
  .object({
    companyId: uuidSchema,
    title: requiredText(200, "Inserisci il titolo della selezione"),
    status: z.enum(SELECTION_STATUSES),
    openedAt: optionalDate,
    closedAt: optionalDate,
  })
  .refine((value) => !value.openedAt || !value.closedAt || value.closedAt >= value.openedAt, {
    message: "La chiusura deve seguire l'apertura",
    path: ["closedAt"],
  })
  .transform((value) => ({ ...value, openedAt: toStartOfDay(value.openedAt), closedAt: toStartOfDay(value.closedAt) }));

export const jobDescriptionSchema = z
  .object({
    title: requiredText(200, "Inserisci il titolo"),
    summary: optionalText(2000),
    duties: optionalText(6000),
    requirements: optionalText(6000),
    employmentType: optionalEnum(WORK_TIMES),
    workTime: optionalEnum(WORK_TIMES),
    workMode: optionalEnum(WORK_MODES),
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value === "" || /^[A-Z]{3}$/.test(value), "Valuta ISO di 3 lettere (es. EUR)")
      .transform((value) => value || null),
    workingHours: optionalText(200),
    locationCity: optionalText(100),
    locationProvince: optionalProvince,
    locationRegion: optionalText(60),
    notes: optionalText(2000),
  })
  .refine((value) => value.salaryMin === null || value.salaryMax === null || value.salaryMax >= value.salaryMin, {
    message: "Il massimo deve essere maggiore o uguale al minimo",
    path: ["salaryMax"],
  });
