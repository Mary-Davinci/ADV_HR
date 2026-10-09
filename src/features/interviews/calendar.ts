import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

export const CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/** Intervallo visibile per una vista calendario (settimana da lunedì). */
export function getCalendarRange(view: CalendarView, anchor: Date): { from: Date; to: Date; days: Date[] } {
  switch (view) {
    case "day":
      return { from: startOfDay(anchor), to: endOfDay(anchor), days: [startOfDay(anchor)] };
    case "week": {
      const from = startOfWeek(anchor, WEEK_OPTIONS);
      const to = endOfWeek(anchor, WEEK_OPTIONS);
      return { from, to, days: eachDayOfInterval({ start: from, end: to }) };
    }
    case "month": {
      // Griglia completa: da lunedì della prima settimana a domenica dell'ultima.
      const from = startOfWeek(startOfMonth(anchor), WEEK_OPTIONS);
      const to = endOfWeek(endOfMonth(anchor), WEEK_OPTIONS);
      return { from, to, days: eachDayOfInterval({ start: from, end: to }) };
    }
  }
}

export function shiftAnchor(view: CalendarView, anchor: Date, direction: 1 | -1): Date {
  switch (view) {
    case "day":
      return direction === 1 ? addDays(anchor, 1) : subDays(anchor, 1);
    case "week":
      return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
    case "month":
      return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
  }
}

export const toDayParam = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * Astrazione per future integrazioni (Google Calendar, Outlook/Microsoft 365).
 * NON implementata in V1: il calendario mostra solo i colloqui di ADV_HR.
 */
export interface ExternalCalendarProvider {
  readonly id: "google" | "microsoft";
  /** Pubblica o aggiorna l'evento esterno di un colloquio; restituisce l'id esterno. */
  upsertInterviewEvent(input: {
    interviewId: string;
    title: string;
    start: Date;
    end: Date;
    location: string | null;
  }): Promise<string>;
  deleteInterviewEvent(externalId: string): Promise<void>;
}
