import { z } from "zod";

import {
  APPLICATION_SOURCES,
  EVALUATION_RESULTS,
  FEEDBACK_TYPES,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  isEvaluationReasonRequired,
} from "@/domain";
import { optionalInt, optionalText, uuidSchema } from "@/lib/zod-helpers";

const optionalUuid = z.union([z.literal("").transform(() => null), uuidSchema]);

export const createApplicationSchema = z.object({
  candidateId: uuidSchema,
  selectionId: uuidSchema,
  recruiterId: optionalUuid,
  source: z.enum(APPLICATION_SOURCES),
});

export const changeStageSchema = z.object({
  applicationId: uuidSchema,
  stageId: uuidSchema,
  reason: optionalText(1000),
});

/** Regola HR: "non idoneo" richiede sempre una motivazione (verificata anche da servizio e DB). */
export const evaluationSchema = z
  .object({
    result: z.enum(EVALUATION_RESULTS),
    reason: optionalText(1000),
    notes: optionalText(2000),
  })
  .refine((value) => !isEvaluationReasonRequired(value.result) || Boolean(value.reason), {
    message: "Indica il motivo della non idoneità",
    path: ["reason"],
  });

export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  content: z.string().trim().min(3, "Scrivi almeno qualche parola").max(4000, "Massimo 4000 caratteri"),
  interviewId: optionalUuid,
});

const dateTimeLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data e ora non valide")
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()), "Data e ora non valide");

export const interviewSchema = z
  .object({
    scheduledAt: dateTimeLocal,
    durationMinutes: optionalInt(5, 600),
    type: z.enum(INTERVIEW_TYPES),
    status: z.enum(INTERVIEW_STATUSES),
    recruiterId: optionalUuid,
    location: optionalText(200),
    meetingUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => value === "" || /^https:\/\//i.test(value), "Inserisci un link https://")
      .transform((value) => value || null),
    notes: optionalText(2000),
  })
  .refine((value) => value.location || value.meetingUrl || value.type === "SCREENING", {
    message: "Indica un luogo o un link per il colloquio",
    path: ["location"],
  });

export const applicationInput = <T extends z.ZodType>(values: T) => z.object({ applicationId: uuidSchema, values });
export const interviewInput = <T extends z.ZodType>(values: T) => z.object({ interviewId: uuidSchema, values });
