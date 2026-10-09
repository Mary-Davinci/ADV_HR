import { SearchX, UserSearch } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { CandidateSearchBar } from "@/features/candidates/components/candidate-search-bar";
import { CandidateTable } from "@/features/candidates/components/candidate-table";
import { CreateCandidateButton } from "@/features/candidates/components/create-candidate-button";
import {
  hasActiveFilters,
  PAGE_SIZE,
  parseCandidateFilters,
  toCandidateSearchQuery,
  toSearchParams,
} from "@/features/candidates/schemas/candidate-filters";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Candidati" };

export default async function RecruitingPage({ searchParams }: PageProps<"/recruiting">) {
  const user = await requirePermission("candidate.read");
  const filters = parseCandidateFilters(await searchParams);
  const services = await getServices();

  const [result, stages, recruiters] = await Promise.all([
    services.candidates.search(toCandidateSearchQuery(filters, new Date())),
    services.applications.listStages(),
    services.users.listRecruiters(),
  ]);
  const filtered = hasActiveFilters(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidati"
        description="Ricerca strutturata tra tutti i candidati. Seleziona un nominativo per aprire la scheda completa."
        actions={can(user, "candidate.create") ? <CreateCandidateButton /> : undefined}
      />

      <CandidateSearchBar
        filters={filters}
        stages={stages.map((stage) => ({ value: stage.code, label: stage.label }))}
        recruiters={recruiters.map((recruiter) => ({ value: recruiter.id, label: recruiter.displayName }))}
      />

      <section aria-labelledby="results-heading" className="space-y-3">
        <h2 id="results-heading" className="text-sm text-muted-foreground" aria-live="polite">
          {result.total === 1 ? "1 candidato" : `${result.total} candidati`}
          {filtered && " corrispondenti ai filtri"}
        </h2>

        {result.items.length > 0 ? (
          <>
            <CandidateTable items={result.items} />
            <Pagination
              page={filters.page ?? 1}
              pageSize={PAGE_SIZE}
              total={result.total}
              hrefFor={(page) => `/recruiting${toSearchParams({ ...filters, page })}`}
            />
          </>
        ) : filtered ? (
          <EmptyState
            icon={SearchX}
            title="Nessun candidato trovato"
            description="Nessun risultato per i criteri selezionati. Prova ad allargare la ricerca o ad azzerare i filtri."
            action={
              <ButtonLink variant="outline" href="/recruiting">
                Azzera filtri
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={UserSearch}
            title="Nessun candidato registrato"
            description="Inserisci il primo candidato per iniziare."
          />
        )}
      </section>
    </div>
  );
}
