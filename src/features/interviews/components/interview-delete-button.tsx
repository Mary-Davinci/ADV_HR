"use client";

import { Trash2 } from "lucide-react";

import { ConfirmButton } from "@/components/common/confirm-button";
import { removeInterviewAction } from "@/features/recruiting/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";

export function InterviewDeleteButton({ interviewId, candidateName }: { interviewId: string; candidateName: string }) {
  const remove = useActionMutation(removeInterviewAction, { successMessage: "Colloquio eliminato" });

  return (
    <ConfirmButton
      variant="destructive"
      size="sm"
      aria-label={`Elimina colloquio con ${candidateName}`}
      title="Eliminare il colloquio?"
      description="Il colloquio verrà eliminato, vuoi procedere?"
      confirmLabel="Elimina"
      disabled={remove.isPending}
      onConfirm={() => remove.mutateAsync({ interviewId })}
    >
      <Trash2 aria-hidden="true" />
      Elimina
    </ConfirmButton>
  );
}
