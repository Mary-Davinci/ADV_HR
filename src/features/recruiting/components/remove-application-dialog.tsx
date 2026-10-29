"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ApplicationView } from "@/repositories/types";

import { removeApplicationAction } from "../server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Conferma esplicita: elenca ciò che verrà eliminato insieme alla candidatura. */
export function RemoveApplicationDialog({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  related,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  candidateName: string;
  related: ApplicationView["related"];
}) {
  const router = useRouter();
  const remove = useActionMutation(removeApplicationAction, {
    successMessage: `${candidateName} rimosso dalla selezione`,
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });
  const lost = [
    related.evaluations > 0 && plural(related.evaluations, "valutazione", "valutazioni"),
    related.feedbacks > 0 && plural(related.feedbacks, "feedback", "feedback"),
    related.interviews > 0 &&
      `${plural(related.interviews, "colloquio", "colloqui")}${
        related.scheduledInterviews > 0 ? ` (di cui ${related.scheduledInterviews} programmati)` : ""
      }`,
  ].filter(Boolean);
  const blocked = related.documents > 0;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rimuovere {candidateName} dalla selezione?</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked
              ? `La candidatura ha ${plural(related.documents, "documento collegato", "documenti collegati")}: eliminali prima di rimuoverla.`
              : lost.length > 0
                ? `Verranno eliminati anche: ${lost.join(", ")}. Il candidato resta in archivio e potrà essere aggiunto di nuovo.`
                : "Il candidato resta in archivio e potrà essere aggiunto di nuovo. L'operazione resta nello storico."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Annulla</AlertDialogCancel>
          {!blocked && (
            <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate({ applicationId })}>
              {remove.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              Rimuovi dalla selezione
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
