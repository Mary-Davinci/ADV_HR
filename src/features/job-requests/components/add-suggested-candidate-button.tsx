"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createApplicationAction } from "@/features/recruiting/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";

export function AddSuggestedCandidateButton({
  candidateId,
  selectionId,
  name,
}: {
  candidateId: string;
  selectionId: string;
  name: string;
}) {
  const router = useRouter();
  const add = useActionMutation(createApplicationAction, {
    successMessage: `${name} aggiunto alla selezione`,
    onSuccess: () => router.refresh(),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={add.isPending}
      aria-label={`Aggiungi ${name} alla selezione`}
      onClick={() => add.mutate({ candidateId, selectionId, recruiterId: "", source: "ADV_HR" })}
    >
      {add.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserPlus aria-hidden="true" />}
      Aggiungi alla selezione
    </Button>
  );
}
