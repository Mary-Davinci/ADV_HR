import { Sparkles, Users } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getServices } from "@/lib/server/services";

import { CompatibleCandidatesList } from "./compatible-candidates-list";

/**
 * Candidati compatibili con la posizione della selezione. Caricati a parte
 * (in Suspense) per non rallentare l'apertura della selezione.
 */
export async function CompatibleCandidates({ selectionId, canAdd }: { selectionId: string; canAdd: boolean }) {
  const result = await (await getServices()).selections.compatibleCandidates(selectionId);
  if (!result) return null;
  const { keywords, total, items, jobProvince } = result;

  return (
    <Card role="region" aria-labelledby="compatible-heading">
      <CardHeader className="space-y-1">
        <h2 id="compatible-heading" className="flex items-center gap-2 text-base font-medium">
          <Sparkles aria-hidden="true" className="size-4" />
          Candidati compatibili con la posizione
        </h2>
        <p className="text-sm text-muted-foreground">
          Figura cercata: <span className="font-medium text-foreground">{keywords.role.join(", ") || "—"}</span>
          {keywords.bonus.length > 0 && (
            <>
              {" "}
              · requisiti: <span className="text-foreground">{keywords.bonus.join(", ")}</span>
            </>
          )}
          . Ordine: prima chi ha già svolto questo mestiere (poi chi lo cita nel CV o lo indica come interesse), poi per
          esperienza (5+ anni, 2-4, 1), vicinanza alla sede{jobProvince ? ` (${jobProvince})` : ""} e requisiti trovati.
          La scelta resta a HR: aggiungere candidati non invia nulla all&apos;azienda.
        </p>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {items.length < total ? `Mostrati i ${items.length} più pertinenti su ${total}` : `${total} candidati`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {keywords.role.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Posizione non indicata"
            description="Scrivi nel titolo della selezione la figura cercata (es. “Commerciale”, “Elettricista”)."
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nessun candidato compatibile"
            description="Nessun candidato ha questa figura nei dati o nel CV. Prova un titolo più generico."
          />
        ) : (
          <CompatibleCandidatesList selectionId={selectionId} items={items} canAdd={canAdd} />
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
