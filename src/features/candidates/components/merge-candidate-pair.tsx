"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Candidate } from "@/domain";
import type { CandidateProfileView } from "@/services/candidate-service";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { mergeCandidatesAction, previewCandidateMergeAction } from "../server/actions";

export function MergeCandidatePair({
  left,
  right,
  reasons,
  canMerge,
}: {
  left: Candidate;
  right: Candidate;
  reasons: string[];
  canMerge: boolean;
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState(left.fiscalCode ? left.id : right.id);
  const [preview, setPreview] = useState<{ source: CandidateProfileView; target: CandidateProfileView } | null>(null);
  const sourceId = targetId === left.id ? right.id : left.id;
  const load = useActionMutation(previewCandidateMergeAction, { onSuccess: setPreview });
  const merge = useActionMutation(mergeCandidatesAction, {
    successMessage: "Schede unite",
    onSuccess: ({ id }) => {
      setPreview(null);
      router.push(`/recruiting/${id}`);
    },
  });
  const conflictingFiscal = Boolean(left.fiscalCode && right.fiscalCode && left.fiscalCode !== right.fiscalCode);
  const counts = (profile: CandidateProfileView) =>
    `${profile.applications.length} candidature, ${profile.interviews.length} colloqui, ${profile.documents.length} documenti`;
  return (
    <article className="space-y-4 rounded-xl border bg-card p-4">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{reasons.join(" · ")}</p>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-sm">Scegli la scheda principale da conservare</legend>
        {[left, right].map((candidate) => (
          <label key={candidate.id} className="flex gap-3 rounded-lg border p-3 text-sm">
            <input
              type="radio"
              name={`primary-${left.id}-${right.id}`}
              checked={targetId === candidate.id}
              onChange={() => setTargetId(candidate.id)}
              disabled={!canMerge}
            />
            <span className="min-w-0 space-y-1 break-words">
              <Link href={`/recruiting/${candidate.id}`} className="block font-medium underline">
                {candidate.firstName} {candidate.lastName}
              </Link>
              <span className="block">Codice fiscale: {candidate.fiscalCode ?? "Non presente"}</span>
              <span className="block">{candidate.email ?? "Email non presente"}</span>
              <span className="block">{candidate.phone ?? "Telefono non presente"}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {conflictingFiscal && (
        <p className="text-sm text-destructive">Codici fiscali diversi: verifica le due identità prima di unirle.</p>
      )}
      {canMerge && (
        <Button
          variant="outline"
          disabled={conflictingFiscal || load.isPending}
          onClick={() => load.mutate({ sourceId, targetId })}
        >
          Confronta e unisci
        </Button>
      )}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open && !merge.isPending) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verifica l&apos;unione delle schede</DialogTitle>
            <DialogDescription>
              La scheda principale mantiene i valori già compilati. I campi vuoti vengono completati con quelli
              dell&apos;altra scheda. Le versioni precedenti vengono archiviate.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <p>
                <strong>Scheda principale:</strong> {preview.target.fullName} — {counts(preview.target)}
              </p>
              <p>
                <strong>Scheda da incorporare:</strong> {preview.source.fullName} — {counts(preview.source)}
              </p>
              <p>
                Tutti i colloqui, i documenti, gli esiti, le note, i task e le esperienze confluiscono nella scheda
                principale. I collegamenti con ADV Core vengono conservati.
              </p>
              {preview.source.applications.some((item) =>
                preview.target.applications.some((main) => main.selection.id === item.selection.id),
              ) && (
                <div className="rounded-lg border border-amber-300 p-3">
                  <p className="font-medium">Candidature nella stessa selezione</p>
                  <ul>
                    {preview.target.applications
                      .filter((item) =>
                        preview.source.applications.some((other) => other.selection.id === item.selection.id),
                      )
                      .map((item) => (
                        <li key={item.application.id}>
                          {item.selection.title}: resta la fase “{item.stage.label}”.{" "}
                          {item.application.closedAt ? "I colloqui ancora programmati vengono annullati." : ""}
                        </li>
                      ))}
                  </ul>
                  <p>Gli esiti di entrambe le schede restano nello storico.</p>
                </div>
              )}
              <ConfirmButton
                variant="destructive"
                title="Confermare l'unione?"
                description="Le due schede diventeranno una sola. Questa operazione non si annulla dall'interfaccia: controlla di aver scelto la stessa persona e la scheda principale corretta."
                confirmLabel="Unisci schede"
                disabled={merge.isPending}
                onConfirm={() =>
                  merge.mutateAsync({ sourceId: preview.source.candidate.id, targetId: preview.target.candidate.id })
                }
              >
                Conferma unione
              </ConfirmButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
