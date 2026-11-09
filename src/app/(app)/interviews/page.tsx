import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { UrlFilterBar } from "@/components/common/url-filter-bar";
import { INTERVIEW_STATUS_LABELS, optionsOf } from "@/config/labels";
import { InterviewList } from "@/features/interviews/components/interview-list";
import {
  buildInterviewQuery,
  DEFAULT_INTERVIEW_VIEW,
  interviewFiltersSchema,
  INTERVIEW_PAGE_SIZE as PAGE_SIZE,
  INTERVIEW_VIEWS as VIEWS,
} from "@/features/interviews/filters";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Colloqui" };

type View = keyof typeof VIEWS;

export default async function InterviewsPage({ searchParams }: PageProps<"/interviews">) {
  const user = await requirePermission("interview.read");
  const raw = await searchParams;
  const filters = interviewFiltersSchema.parse(raw);
  const view: View = filters.view ?? DEFAULT_INTERVIEW_VIEW;
  const services = await getServices();
  const [result, recruiters, companies] = await Promise.all([
    services.interviews.list(buildInterviewQuery(filters, new Date())),
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
            allLabel: view === "upcoming" && !filters.date ? "Programmati" : "Tutti gli stati",
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
        {(["recruiter", "company", "status"] as const).map((key) =>
          filters[key] ? <input key={key} type="hidden" name={key} value={filters[key]} /> : null,
        )}
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
