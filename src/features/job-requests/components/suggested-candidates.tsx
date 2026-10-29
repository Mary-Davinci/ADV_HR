import { Check, CircleHelp, FileWarning, Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EDUCATION_LEVEL_LABELS } from "@/config/labels";
import type { SuggestedCandidate } from "@/services/job-request-service";
import type { JobSearchCriteria } from "@/services/matching/job-criteria";

import { AddSuggestedCandidateButton } from "./add-suggested-candidate-button";

function Evidence({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  const Icon = ok ? Check : CircleHelp;
  return (
    <li className="flex items-start gap-1.5">
      <Icon
        aria-hidden="true"
        className={ok ? "mt-0.5 size-3.5 shrink-0 text-emerald-600" : "mt-0.5 size-3.5 shrink-0 text-muted-foreground"}
      />
      <span className={ok ? undefined : "text-muted-foreground"}>{children}</span>
    </li>
  );
}

/**
 * Candidati suggeriti per la job description. Spiegabili: ogni riga mostra
 * i criteri soddisfatti; un dato mancante è "da verificare", mai un no.
 */
export function SuggestedCandidates({
  criteria,
  total,
  items,
  selectionId,
  canAdd,
}: {
  criteria: JobSearchCriteria;
  total: number;
  items: SuggestedCandidate[];
  selectionId: string | null;
  canAdd: boolean;
}) {
  return (
    <Card role="region" aria-labelledby="suggested-heading">
      <CardHeader className="space-y-1">
        <h2 id="suggested-heading" className="flex items-center gap-2 text-base font-medium">
          <Users aria-hidden="true" className="size-4" />
          Candidati suggeriti
        </h2>
        <p className="text-sm text-muted-foreground">
          Confronto con zona di lavoro (provincia {criteria.province}), titolo di studio
          {criteria.minEducationLevel ? ` (almeno ${EDUCATION_LEVEL_LABELS[criteria.minEducationLevel]})` : ""} e parole
          chiave nel CV: <span className="font-medium text-foreground">{criteria.keywords.join(", ") || "—"}</span>.
          Ordinati per criteri soddisfatti (riscontri nel CV, poi provincia, poi regione). La scelta resta a HR.
        </p>
        <p className="text-xs text-muted-foreground">
          {items.length < total ? `Mostrati i primi ${items.length} di ${total}` : `${total} candidati`} che soddisfano
          almeno un criterio. I CV scansionati non sono leggibili dal sistema: per quei candidati il CV va aperto a
          mano.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nessun candidato suggerito"
            description="Nessun candidato soddisfa i criteri."
          />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.candidateId}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <Link href={`/recruiting/${item.candidateId}`} className="font-medium hover:underline">
                    {item.firstName} {item.lastName}
                  </Link>
                  <ul className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                    <Evidence ok={item.sameProvince || item.sameRegion}>
                      {item.residenceCity
                        ? `Residente a ${item.residenceCity}${item.residenceProvince ? ` (${item.residenceProvince})` : ""}`
                        : "Residenza non indicata"}
                      {item.sameProvince ? " · stessa provincia" : item.sameRegion ? " · stessa regione" : ""}
                    </Evidence>
                    <Evidence ok={item.educationOk}>
                      {item.bestEducationLevel
                        ? EDUCATION_LEVEL_LABELS[item.bestEducationLevel]
                        : "Titolo di studio non indicato"}
                      {item.educationOk === false ? " · inferiore al richiesto" : ""}
                    </Evidence>
                    <Evidence ok={item.matchedKeywords.length > 0}>
                      {item.matchedKeywords.length > 0
                        ? `Nel CV: ${item.matchedKeywords.join(", ")}`
                        : item.hasReadableCv
                          ? "Nessuna parola chiave nel CV"
                          : item.hasCv
                            ? "CV scansionato: da leggere a mano"
                            : "Nessun CV"}
                    </Evidence>
                  </ul>
                </div>
                {selectionId && canAdd && (
                  <div className="shrink-0">
                    {item.alreadyInSelection ? (
                      <span className="text-sm text-muted-foreground">Già nella selezione</span>
                    ) : (
                      <AddSuggestedCandidateButton
                        candidateId={item.candidateId}
                        selectionId={selectionId}
                        name={`${item.firstName} ${item.lastName}`}
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {!selectionId && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <FileWarning aria-hidden="true" className="size-3.5" />
            Potrai aggiungere i candidati alla selezione dopo l&apos;approvazione del modulo firmato.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
