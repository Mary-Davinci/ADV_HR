import { Compass } from "lucide-react";
import Link from "next/link";

import { DetailSection } from "@/components/common/detail-section";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getServices } from "@/lib/server/services";
import type { PositionMatchSource } from "@/repositories/types";

import { AddToRecommendedButton } from "./add-to-recommended-button";

const SOURCE_REASON: Record<PositionMatchSource, string> = {
  EXPERIENCE: "Ha già svolto il mestiere",
  CV: "Mestiere citato nel CV",
  INTEREST: "Lo indica come interesse",
  DETAILS: "Mestiere in formazione o note",
};

/**
 * Selezioni aperte più pertinenti per il candidato (caricate a parte, in
 * Suspense, per non rallentare l'apertura della scheda). La scelta resta a HR.
 */
export async function RecommendedSelections({ candidateId, canAdd }: { candidateId: string; canAdd: boolean }) {
  const items = await (await getServices()).candidates.recommendedSelections(candidateId);

  return (
    <DetailSection title="Posizioni consigliate" icon={Compass}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna selezione aperta compatibile con il profilo, oltre a quelle in cui è già candidato.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const source = item.roleFoundIn[0];
            return (
              <li key={item.selectionId} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/companies/${item.companyId}/selections/${item.selectionId}`}
                      className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                      title={item.title}
                    >
                      {item.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{item.companyName}</p>
                  </div>
                  {canAdd && (
                    <AddToRecommendedButton
                      candidateId={candidateId}
                      selectionId={item.selectionId}
                      title={item.title}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {source && (
                    <Badge variant="secondary" className="font-normal">
                      {SOURCE_REASON[source]}
                    </Badge>
                  )}
                  {item.sameProvince ? (
                    <Badge variant="outline" className="font-normal">
                      Stessa provincia
                    </Badge>
                  ) : (
                    item.sameRegion && (
                      <Badge variant="outline" className="font-normal">
                        Stessa regione
                      </Badge>
                    )
                  )}
                  {item.matchedRequirements.slice(0, 3).map((requirement) => (
                    <Badge key={requirement} variant="outline" className="font-normal">
                      {requirement}
                    </Badge>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DetailSection>
  );
}

export function RecommendedSelectionsSkeleton() {
  return (
    <DetailSection title="Posizioni consigliate" icon={Compass}>
      <div className="space-y-3" aria-busy="true" aria-label="Caricamento delle posizioni consigliate">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </DetailSection>
  );
}
