"use client";

import {
  CalendarPlus,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  UserMinus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Interview, RecruitingStage } from "@/domain";
import type { ApplicationView } from "@/repositories/types";
import { useActionMutation } from "@/hooks/use-action-mutation";

import { REJECTION_STAGE_CODE } from "../constants";
import { getStagePresentation } from "../stage-presentation";
import { changeStageAction } from "../server/actions";
import { EvaluationDialog, FeedbackDialog, InterviewDialog, RejectDialog, useDialogState } from "./application-dialogs";
import { RemoveApplicationDialog } from "./remove-application-dialog";

export interface ApplicationActionsProps {
  applicationId: string;
  candidateName: string;
  stageId: string;
  stages: RecruitingStage[];
  interviews: Array<Pick<Interview, "id" | "scheduledAt" | "type">>;
  recruiters: Array<{ id: string; displayName: string }>;
  recruiterId: string | null;
  permissions: { manage: boolean; evaluate: boolean; feedback: boolean; interview: boolean };
  compact?: boolean;
  /** Dati collegati alla candidatura: se presenti (e con permesso), compare "Rimuovi dalla selezione". */
  related?: ApplicationView["related"];
}

type DialogName = "reject" | "evaluate" | "feedback" | "interview" | "remove";

/**
 * Azioni su una candidatura. Ogni cambio di stage aggiorna la candidatura e
 * registra activity + audit in una transazione (server). Lo scarto apre
 * sempre il dialog con motivazione obbligatoria.
 */
export function ApplicationActions(props: ApplicationActionsProps) {
  const { applicationId, candidateName, stageId, stages, permissions, compact } = props;
  const dialogs = useDialogState<DialogName>();
  const rejectStage = stages.find((stage) => stage.code === REJECTION_STAGE_CODE);
  const changeStage = useActionMutation(changeStageAction, {
    successMessage: (_: void) => `${candidateName}: stato aggiornato`,
  });

  function onStageSelected(nextStageId: string) {
    if (nextStageId === stageId) return;
    if (nextStageId === rejectStage?.id) {
      dialogs.show("reject");
      return;
    }
    changeStage.mutate({ applicationId, stageId: nextStageId, reason: "" });
  }

  const canRemove = permissions.manage && props.related !== undefined;
  const hasSecondary = permissions.evaluate || permissions.feedback || permissions.interview || canRemove;

  return (
    <div className={compact ? "flex items-center gap-1" : "flex flex-wrap items-center gap-2"}>
      {permissions.manage && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                disabled={changeStage.isPending}
                aria-label={`Cambia stato di ${candidateName}`}
              />
            }
          >
            {changeStage.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            Stato
            <ChevronDown aria-hidden="true" data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Stato della candidatura</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={stageId} onValueChange={(value) => onStageSelected(String(value))}>
                {stages.map((stage) => {
                  const Icon = getStagePresentation(stage.code).icon;
                  return (
                    <DropdownMenuRadioItem key={stage.id} value={stage.id} closeOnClick>
                      <Icon aria-hidden="true" />
                      {stage.label}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {hasSecondary &&
        (compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Altre azioni per ${candidateName}`} />}
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {permissions.evaluate && (
                <DropdownMenuItem onClick={() => dialogs.show("evaluate")}>
                  <ClipboardCheck aria-hidden="true" />
                  Valuta
                </DropdownMenuItem>
              )}
              {permissions.feedback && (
                <DropdownMenuItem onClick={() => dialogs.show("feedback")}>
                  <MessageSquarePlus aria-hidden="true" />
                  Aggiungi feedback
                </DropdownMenuItem>
              )}
              {permissions.interview && (
                <DropdownMenuItem onClick={() => dialogs.show("interview")}>
                  <CalendarPlus aria-hidden="true" />
                  Programma colloquio
                </DropdownMenuItem>
              )}
              {canRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => dialogs.show("remove")}>
                    <UserMinus aria-hidden="true" />
                    Rimuovi dalla selezione
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            {permissions.evaluate && (
              <Button variant="outline" size="sm" onClick={() => dialogs.show("evaluate")}>
                <ClipboardCheck aria-hidden="true" />
                Valuta
              </Button>
            )}
            {permissions.feedback && (
              <Button variant="outline" size="sm" onClick={() => dialogs.show("feedback")}>
                <MessageSquarePlus aria-hidden="true" />
                Feedback
              </Button>
            )}
            {permissions.interview && (
              <Button variant="outline" size="sm" onClick={() => dialogs.show("interview")}>
                <CalendarPlus aria-hidden="true" />
                Colloquio
              </Button>
            )}
            {canRemove && (
              <Button variant="ghost" size="sm" onClick={() => dialogs.show("remove")}>
                <UserMinus aria-hidden="true" />
                Rimuovi
              </Button>
            )}
          </>
        ))}

      {rejectStage && (
        <RejectDialog
          {...dialogs.props("reject")}
          applicationId={applicationId}
          candidateName={candidateName}
          stageId={rejectStage.id}
        />
      )}
      <EvaluationDialog {...dialogs.props("evaluate")} applicationId={applicationId} candidateName={candidateName} />
      <FeedbackDialog
        {...dialogs.props("feedback")}
        applicationId={applicationId}
        candidateName={candidateName}
        interviews={props.interviews}
      />
      {canRemove && props.related && (
        <RemoveApplicationDialog
          {...dialogs.props("remove")}
          applicationId={applicationId}
          candidateName={candidateName}
          related={props.related}
        />
      )}
      <InterviewDialog
        {...dialogs.props("interview")}
        applicationId={applicationId}
        candidateName={candidateName}
        recruiters={props.recruiters}
        defaultRecruiterId={props.recruiterId}
      />
    </div>
  );
}
