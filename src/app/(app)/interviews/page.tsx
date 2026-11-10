import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { UrlFilterBar } from "@/components/common/url-filter-bar";
import { InterviewsTable } from "@/features/interviews/components/interviews-table";
import {
  buildInterviewQuery,
  DEFAULT_INTERVIEW_VIEW,
  interviewFiltersSchema,
  INTERVIEW_PAGE_SIZE as PAGE_SIZE,
  INTERVIEW_VIEWS as VIEWS,
  type InterviewView as View,
} from "@/features/interviews/filters";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Colloqui" };

export default async function InterviewsPage({ searchParams }: PageProps<"/interviews">) {
  await requirePermission("interview.read");
  const filters = interviewFiltersSchema.parse(await searchParams);
  const view: View = filters.view ?? DEFAULT_INTERVIEW_VIEW;
  const other: View = view === "todo" ? "done" : "todo";
  const services = await getServices();
  const [result, otherCount, recruiters, companies] = await Promise.all([
    services.interviews.list(buildInterviewQuery(filters, view)),
    // Solo il totale dell'altra vista, per il numero nello switcher.
    services.interviews
      .list({ ...buildInterviewQuery({ ...filters, page: undefined }, other), limit: 1 })
      .then((page) => page.total),
    services.users.listRecruiters(),
    services.companies.options(),
  ]);
  const totals: Record<View, number> = { [view]: result.total, [other]: otherCount } as Record<View, number>;

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
        description="Colloqui e chiamate da fare e già svolti. Seleziona una riga per aprire la scheda del candidato."
      />

      <nav aria-label="Vista colloqui" className="inline-flex rounded-xl border bg-muted/40 p-1">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <Link
            key={key}
            href={hrefFor({ view: key, page: undefined })}
            aria-current={view === key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              view === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {VIEWS[key]}
            <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{totals[key]}</span>
          </Link>
        ))}
      </nav>

      <UrlFilterBar
        searchLabel="Cerca colloqui per candidato, selezione o azienda"
        searchPlaceholder="Candidato, selezione o azienda…"
        selects={[
          {
            param: "recruiter",
            label: "Filtra per recruiter",
            allLabel: "Tutti i recruiter",
            options: recruiters.map((recruiter) => ({ value: recruiter.id, label: recruiter.displayName })),
          },
          {
            param: "company",
            label: "Filtra per azienda",
            allLabel: "Tutte le aziende",
            options: companies.map((company) => ({ value: company.id, label: company.name })),
          },
        ]}
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={view === "todo" ? "Nessun colloquio da fare" : "Nessun colloquio svolto"}
          description={
            view === "todo"
              ? "I colloqui si programmano dalla candidatura, nella scheda del candidato o della selezione."
              : "Modifica la ricerca o i filtri."
          }
        />
      ) : (
        <InterviewsTable items={result.items} done={view === "done"} now={new Date()} />
      )}
      <Pagination
        page={filters.page ?? 1}
        pageSize={PAGE_SIZE}
        total={result.total}
        hrefFor={(page) => hrefFor({ page })}
      />
    </div>
  );
}
