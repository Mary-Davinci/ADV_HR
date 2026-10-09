import { format, isSameDay, isSameMonth, isToday, isValid, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { ButtonLink } from "@/components/common/button-link";
import { PageHeader } from "@/components/common/page-header";
import { InterviewList } from "@/features/interviews/components/interview-list";
import {
  CALENDAR_VIEWS,
  getCalendarRange,
  shiftAnchor,
  toDayParam,
  type CalendarView,
} from "@/features/interviews/calendar";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getServices } from "@/lib/server/services";
import type { InterviewView } from "@/repositories/types";

export const metadata: Metadata = { title: "Calendario" };

const VIEW_LABELS: Record<CalendarView, string> = { day: "Giorno", week: "Settimana", month: "Mese" };
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const schema = z.object({
  view: z.preprocess(first, z.enum(CALENDAR_VIEWS).optional()).catch(undefined),
  date: z
    .preprocess(
      first,
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    )
    .catch(undefined),
});

function EventLink({ view, compact }: { view: InterviewView; compact?: boolean }) {
  const cancelled = view.interview.status === "CANCELLED" || view.interview.status === "NO_SHOW";
  return (
    <Link
      href={`/recruiting/${view.candidate.id}?tab=interviews`}
      className={cn(
        "block truncate rounded-md border-l-2 px-1.5 py-0.5 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        cancelled ? "border-muted-foreground/40 text-muted-foreground line-through" : "border-primary bg-accent/60",
      )}
      title={`${format(view.interview.scheduledAt, "HH:mm")} ${view.candidate.fullName} — ${view.selection.title}`}
    >
      <span className="font-medium tabular-nums">{format(view.interview.scheduledAt, "HH:mm")}</span>{" "}
      {view.candidate.fullName}
      {!compact && <span className="block truncate text-muted-foreground">{view.company.name}</span>}
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requirePermission("interview.read");
  const params = schema.parse(await searchParams);
  const view: CalendarView = params.view ?? "week";
  const parsed = params.date ? parseISO(params.date) : new Date();
  const anchor = isValid(parsed) ? parsed : new Date();
  const range = getCalendarRange(view, anchor);

  const services = await getServices();
  const [result, recruiters] = await Promise.all([
    services.interviews.list({ from: range.from, to: range.to, order: "asc", limit: 200 }),
    services.users.listRecruiters(),
  ]);
  const byDay = (day: Date) => result.items.filter((item) => isSameDay(item.interview.scheduledAt, day));
  const href = (nextView: CalendarView, date: Date) => `/calendar?view=${nextView}&date=${toDayParam(date)}`;

  const title =
    view === "day"
      ? format(anchor, "EEEE d MMMM yyyy", { locale: it })
      : view === "week"
        ? `${format(range.from, "d MMM", { locale: it })} – ${format(range.to, "d MMM yyyy", { locale: it })}`
        : format(anchor, "MMMM yyyy", { locale: it });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario"
        description="Colloqui programmati. L'integrazione con Google Calendar / Outlook è prevista in una fase successiva."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ButtonLink
            variant="outline"
            size="icon-sm"
            href={href(view, shiftAnchor(view, anchor, -1))}

            aria-label="Periodo precedente"
          >
            <ChevronLeft aria-hidden="true" />
          </ButtonLink>
          <ButtonLink variant="outline" size="sm" href={href(view, new Date())}>
            Oggi
          </ButtonLink>
          <ButtonLink
            variant="outline"
            size="icon-sm"
            href={href(view, shiftAnchor(view, anchor, 1))}

            aria-label="Periodo successivo"
          >
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
          <h2 className="ml-2 text-lg font-medium first-letter:uppercase" aria-live="polite">
            {title}
          </h2>
        </div>
        <nav aria-label="Vista calendario" className="flex rounded-lg border p-0.5">
          {CALENDAR_VIEWS.map((option) => (
            <Link
              key={option}
              href={href(option, anchor)}
              aria-current={option === view ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium",
                option === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_LABELS[option]}
            </Link>
          ))}
        </nav>
      </div>

      {view === "day" && (
        <InterviewList
          items={result.items}
          recruiters={recruiters}
          canManage={can(user, "interview.manage")}
          emptyText="Nessun colloquio in questa giornata."
        />
      )}

      {view === "week" && (
        <ol className="grid gap-3 md:grid-cols-7" aria-label="Giorni della settimana">
          {range.days.map((day) => {
            const events = byDay(day);
            return (
              <li
                key={day.toISOString()}
                className={cn("min-h-40 rounded-xl border bg-card p-2", isToday(day) && "border-primary/50")}
              >
                <Link href={href("day", day)} className="mb-2 flex items-baseline gap-1.5 rounded px-1 hover:underline">
                  <span className="text-xs text-muted-foreground uppercase">{format(day, "EEE", { locale: it })}</span>
                  <span className={cn("text-sm font-semibold", isToday(day) && "text-primary")}>
                    {format(day, "d")}
                  </span>
                  {isToday(day) && <span className="sr-only">(oggi)</span>}
                </Link>
                {events.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">—</p>
                ) : (
                  <ul className="space-y-1">
                    {events.map((event) => (
                      <li key={event.interview.id}>
                        <EventLink view={event} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {view === "month" && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div
            className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground"
            aria-hidden="true"
          >
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-2">
                {weekday}
              </div>
            ))}
          </div>
          <ol className="grid grid-cols-7">
            {range.days.map((day) => {
              const events = byDay(day);
              return (
                <li
                  key={day.toISOString()}
                  className={cn(
                    "min-h-24 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                    !isSameMonth(day, anchor) && "bg-muted/30 text-muted-foreground",
                  )}
                >
                  <Link
                    href={href("day", day)}
                    className={cn(
                      "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-muted",
                      isToday(day) && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                    aria-label={`${format(day, "EEEE d MMMM", { locale: it })}${events.length ? `, ${events.length} colloqui` : ""}`}
                  >
                    {format(day, "d")}
                  </Link>
                  <ul className="space-y-0.5">
                    {events.slice(0, 3).map((event) => (
                      <li key={event.interview.id}>
                        <EventLink view={event} compact />
                      </li>
                    ))}
                    {events.length > 3 && (
                      <li>
                        <Link href={href("day", day)} className="px-1.5 text-xs text-muted-foreground hover:underline">
                          +{events.length - 3} altri
                        </Link>
                      </li>
                    )}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
