import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { UrlFilterBar } from "@/components/common/url-filter-bar";
import { INTERVIEW_STATUS_LABELS, optionsOf } from "@/config/labels";
import { INTERVIEW_STATUSES, type InterviewStatus } from "@/domain";
import { InterviewList } from "@/features/interviews/components/interview-list";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getServices } from "@/lib/server/services";
import type { InterviewQuery } from "@/repositories/types";

export const metadata: Metadata = { title: "Colloqui" };

const VIEWS = { today: "Oggi", upcoming: "Prossimi", past: "Completati e passati" } as const;
type View = keyof typeof VIEWS;
const PAGE_SIZE = 30;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const filtersSchema = z.object({
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

function buildQuery(view: View, filters: z.infer<typeof filtersSchema>, now: Date): InterviewQuery {
  const query: InterviewQuery = {
    recruiterId: filters.recruiter,
    companyId: filters.company,
    statuses: filters.status ? [filters.status] : undefined,
    limit: PAGE_SIZE,
    offset: ((filters.page ?? 1) - 1) * PAGE_SIZE,
  };
  if (filters.date) {
    const day = parseISO(filters.date);
    return { ...query, from: startOfDay(day), to: endOfDay(day), order: "asc" };
  }
  switch (view) {
    case "today":
      return { ...query, from: startOfDay(now), to: endOfDay(now), order: "asc" };
    case "upcoming":
      return {
        ...query,
        from: now,
        statuses: query.statuses ?? (["SCHEDULED"] satisfies InterviewStatus[]),
        order: "asc",
      };
    case "past":
      return { ...query, to: now, order: "desc" };
  }
}

export default async function InterviewsPage({ searchParams }: PageProps<"/interviews">) {
  const user = await requirePermission("interview.read");
  const raw = await searchParams;
  const filters = filtersSchema.parse(raw);
  const view: View = filters.view ?? "today";
  const services = await getServices();
  const [result, recruiters, companies] = await Promise.all([
    services.interviews.list(buildQuery(view, filters, new Date())),
    services.users.listRecruiters(),
    services.companies.options(),
  ]);

  const hrefFor = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, view, ...patch })) {
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
    }
    return `/interviews?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colloqui"
        description="Agenda dei colloqui di selezione. I colloqui si programmano dalla candidatura."
      />

      <nav aria-label="Periodo" className="flex gap-1 border-b">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <Link
            key={key}
            href={hrefFor({ view: key, page: undefined, date: undefined })}
            aria-current={view === key && !filters.date ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              view === key && !filters.date
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {VIEWS[key]}
          </Link>
        ))}
      </nav>

      <UrlFilterBar
        selects={[
          {
            param: "recruiter",
            label: "Filtra per recruiter",
            allLabel: "Tutti i recruiter",
            options: recruiters.map((recruiter) => ({ value: recruiter.id, label: recruiter.displayName })),
          },
          {
            param: "status",
            label: "Filtra per stato",
            allLabel: "Tutti gli stati",
            options: optionsOf(INTERVIEW_STATUS_LABELS),
          },
          {
            param: "company",
            label: "Filtra per azienda",
            allLabel: "Tutte le aziende",
            options: companies.map((company) => ({ value: company.id, label: company.name })),
          },
        ]}
      />
      <form className="flex items-center gap-2 text-sm" action="/interviews">
        <input type="hidden" name="view" value={view} />
        <label htmlFor="interview-date" className="text-muted-foreground">
          Giorno specifico
        </label>
        <input
          id="interview-date"
          type="date"
          name="date"
          defaultValue={filters.date}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        />
        <button type="submit" className="h-8 rounded-lg border px-3 font-medium hover:bg-muted">
          Vai
        </button>
        {filters.date && (
          <Link
            href={hrefFor({ date: undefined, page: undefined })}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            Rimuovi data
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {result.total === 1 ? "1 colloquio" : `${result.total} colloqui`}
      </p>
      <InterviewList
        items={result.items}
        recruiters={recruiters}
        canManage={can(user, "interview.manage")}
        emptyText="Nessun colloquio per i criteri selezionati."
      />
      <Pagination
        page={filters.page ?? 1}
        pageSize={PAGE_SIZE}
        total={result.total}
        hrefFor={(page) => hrefFor({ page })}
      />
    </div>
  );
}
