"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createApplicationsAction } from "@/features/recruiting/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";

/** Aggiunge il candidato a una selezione consigliata (fase iniziale della pipeline). */
export function AddToRecommendedButton({
  candidateId,
  selectionId,
  title,
}: {
  candidateId: string;
  selectionId: string;
  title: string;
}) {
  const router = useRouter();
  const add = useActionMutation(createApplicationsAction, {
    successMessage: `Aggiunto alla selezione "${title}"`,
    onSuccess: () => router.refresh(),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 shrink-0 px-2 text-xs"
      disabled={add.isPending}
      aria-label={`Aggiungi alla selezione ${title}`}
      onClick={() => add.mutate({ selectionId, candidateIds: [candidateId] })}
    >
      {add.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserPlus aria-hidden="true" />}
      Aggiungi
    </Button>
  );
}
