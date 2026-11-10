import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { z } from "zod";

import type { InterviewStatus } from "@/domain";
import type { InterviewQuery } from "@/repositories/types";

/** Due viste: cosa resta da fare (programmati, anche già passati da chiudere) e cosa è concluso. */
export const INTERVIEW_VIEWS = { todo: "Da fare", done: "Svolti" } as const;
export type InterviewView = keyof typeof INTERVIEW_VIEWS;
export const INTERVIEW_PAGE_SIZE = 30;
export const DEFAULT_INTERVIEW_VIEW: InterviewView = "todo";
const DONE_STATUSES: InterviewStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

/** I collegamenti alle vecchie viste (es. dalla dashboard) continuano a funzionare. */
const LEGACY_VIEWS: Record<string, InterviewView> = { today: "todo", upcoming: "todo", past: "done" };

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
export const interviewFiltersSchema = z.object({
  view: z
    .preprocess(
      (value) => {
        const view = first(value);
        return typeof view === "string" ? (LEGACY_VIEWS[view] ?? view) : view;
      },
      z.enum(["todo", "done"]).optional(),
    )
    .catch(undefined),
  q: z.preprocess(first, z.string().trim().max(100).optional()).catch(undefined),
  recruiter: z.preprocess(first, z.uuid().optional()).catch(undefined),
  company: z.preprocess(first, z.uuid().optional()).catch(undefined),
  date: z
    .preprocess(
      first,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    )
    .catch(undefined)
    .refine((value) => !value || isValid(parseISO(value)))
    .catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(500).optional()).catch(undefined),
});

export function buildInterviewQuery(
  filters: z.infer<typeof interviewFiltersSchema>,
  view: InterviewView = filters.view ?? DEFAULT_INTERVIEW_VIEW,
): InterviewQuery {
  const day = filters.date ? parseISO(filters.date) : null;
  return {
    recruiterId: filters.recruiter,
    companyId: filters.company,
    text: filters.q || undefined,
    ...(day ? { from: startOfDay(day), to: endOfDay(day) } : {}),
    // Da fare: dal più vecchio, così i colloqui passati ancora da chiudere restano in cima.
    ...(view === "done" ? { statuses: DONE_STATUSES, order: "desc" } : { statuses: ["SCHEDULED"], order: "asc" }),
    limit: INTERVIEW_PAGE_SIZE,
    offset: ((filters.page ?? 1) - 1) * INTERVIEW_PAGE_SIZE,
  };
}
