import { Sparkles, Users } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getServices } from "@/lib/server/services";
import type { PositionMatchFilters } from "@/domain/position-screening";

import { CompatibleCandidatesList } from "./compatible-candidates-list";

/**
 * Candidati compatibili con la posizione della selezione. Caricati a parte
 * (in Suspense) per non rallentare l'apertura della selezione.
 */
export async function CompatibleCandidates({
  selectionId,
  canAdd,
  filters = {},
}: {
  selectionId: string;
  canAdd: boolean;
  filters?: PositionMatchFilters;
}) {
  const result = await (await getServices()).selections.compatibleCandidates(selectionId, filters);
  if (!result) return null;
  const { keywords, total, items, jobProvince, facets } = result;

  return (
    <Card role="region" aria-labelledby="compatible-heading">
      <CardHeader className="space-y-1">
        <h2 id="compatible-heading" className="flex items-center gap-2 text-base font-medium">
          <Sparkles aria-hidden="true" className="size-4" />
          Candidati compatibili con la posizione
        </h2>
        <p className="text-sm text-muted-foreground">
          Figura cercata:{" "}
          <span className="font-medium text-foreground">
            {keywords.screening.functionLabels.join(", ") || keywords.role.join(", ") || "—"}
          </span>
          {keywords.screening.domainLabels.length > 0 && (
            <>
              {" "}
              · ambito:{" "}
              <span className="font-medium text-foreground">{keywords.screening.domainLabels.join(" / ")}</span>
            </>
          )}
          {keywords.bonus.length > 0 && (
            <>
              {" "}
              · requisiti: <span className="text-foreground">{keywords.bonus.join(", ")}</span>
            </>
          )}
          . Mansioni e requisiti della job description contribuiscono alla ricerca. Prima i riscontri coerenti su
          mestiere e ambito, poi i profili da verificare; seguono riscontri sui requisiti, esperienza dichiarata e
          vicinanza{jobProvince ? ` (${jobProvince})` : ""}. La scelta resta a HR: aggiungere candidati non invia nulla
          all&apos;azienda.
        </p>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {items.length < total ? `Mostrati i ${items.length} più pertinenti su ${total}` : `${total} candidati`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {keywords.role.length === 0 && !keywords.screening.functionPattern && !keywords.screening.domainPattern ? (
          <EmptyState
            icon={Users}
            title="Posizione non indicata"
            description="Scrivi nel titolo della selezione la figura cercata (es. “Commerciale”, “Elettricista”)."
          />
        ) : items.length === 0 && !filters.region && !filters.flags?.length ? (
          <EmptyState
            icon={Users}
            title="Nessun candidato compatibile"
            description="Nessun profilo presenta riscontri sufficienti. Controlla il titolo e completa mansioni e requisiti della job description."
          />
        ) : (
          <CompatibleCandidatesList
            key={JSON.stringify(filters)}
            selectionId={selectionId}
            items={items}
            canAdd={canAdd}
            filters={filters}
            facets={facets}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function CompatibleCandidatesSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Ricerca dei candidati compatibili in corso">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
