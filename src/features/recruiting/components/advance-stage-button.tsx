"use client";

import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useActionMutation } from "@/hooks/use-action-mutation";

import { changeStageAction } from "../server/actions";

/** Porta la candidatura alla fase successiva del percorso (mai a un esito finale). */
export function AdvanceStageButton({
  applicationId,
  candidateName,
  stage,
}: {
  applicationId: string;
  candidateName: string;
  stage: { id: string; label: string };
}) {
  const change = useActionMutation(changeStageAction, {
    successMessage: (_: void) => `${candidateName}: ${stage.label}`,
  });
  return (
    <Button
      size="sm"
      disabled={change.isPending}
      onClick={() => change.mutate({ applicationId, stageId: stage.id, reason: "" })}
    >
      {change.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ArrowRight aria-hidden="true" />}
      Avanza a «{stage.label}»
    </Button>
  );
}
