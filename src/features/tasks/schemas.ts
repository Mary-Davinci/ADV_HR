import { z } from "zod";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/domain";
import { optionalText, requiredText, uuidSchema } from "@/lib/zod-helpers";

const optionalUuid = z.union([z.literal("").transform(() => null), uuidSchema]);

export const taskSchema = z.object({
  title: requiredText(200, "Inserisci il titolo"),
  description: optionalText(2000),
  assignedTo: uuidSchema,
  priority: z.enum(TASK_PRIORITIES),
  dueAt: z.union([
    z.literal("").transform(() => null),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
      .transform((value) => new Date(`${value}T18:00:00`)),
  ]),
  candidateId: optionalUuid,
  applicationId: optionalUuid,
  selectionId: optionalUuid,
});

export const taskStatusSchema = z.object({ taskId: uuidSchema, status: z.enum(TASK_STATUSES) });

export const talentPoolSchema = z.object({
  name: requiredText(120, "Inserisci il nome"),
  description: optionalText(1000),
});

export const poolMemberSchema = z.object({ poolId: uuidSchema, candidateId: uuidSchema });
