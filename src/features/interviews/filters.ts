import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { z } from "zod";

import { INTERVIEW_STATUSES } from "@/domain";
import type { InterviewQuery } from "@/repositories/types";

export const INTERVIEW_VIEWS = { upcoming: "Prossimi", today: "Oggi", past: "Completati e passati" } as const;
export const INTERVIEW_PAGE_SIZE = 30;
export const DEFAULT_INTERVIEW_VIEW = "upcoming";

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
export const interviewFiltersSchema = z.object({
  view: z.preprocess(first, z.enum(["today", "upcoming", "past"]).optional()).catch(undefined),
  recruiter: z.preprocess(first, z.uuid().optional()).catch(undefined),
  company: z.preprocess(first, z.uuid().optional()).catch(undefined),
  status: z.preprocess(first, z.enum(INTERVIEW_STATUSES).optional()).catch(undefined),
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

export function buildInterviewQuery(filters: z.infer<typeof interviewFiltersSchema>, now: Date): InterviewQuery {
  const query: InterviewQuery = {
    recruiterId: filters.recruiter,
    companyId: filters.company,
    statuses: filters.status ? [filters.status] : undefined,
    limit: INTERVIEW_PAGE_SIZE,
    offset: ((filters.page ?? 1) - 1) * INTERVIEW_PAGE_SIZE,
  };
  if (filters.date) {
    const day = parseISO(filters.date);
    return { ...query, from: startOfDay(day), to: endOfDay(day), order: "asc" };
  }
  switch (filters.view ?? DEFAULT_INTERVIEW_VIEW) {
    case "today":
      return { ...query, from: startOfDay(now), to: endOfDay(now), order: "asc" };
    case "upcoming":
      return { ...query, from: now, statuses: query.statuses ?? ["SCHEDULED"], order: "asc" };
    case "past":
      return { ...query, concludedBy: now, order: "desc" };
  }
}
