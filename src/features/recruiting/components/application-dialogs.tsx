"use client";

import { addHours, setMinutes, startOfHour } from "date-fns";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import {
  EVALUATION_RESULT_LABELS,
  FEEDBACK_TYPE_LABELS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  optionsOf,
} from "@/config/labels";
import type { Interview } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/format";
import { toFormValue } from "@/lib/zod-helpers";

import { changeStageSchema, evaluationSchema, feedbackSchema, interviewSchema } from "../schemas";
import {
  addFeedbackAction,
  changeStageAction,
  evaluateApplicationAction,
  scheduleInterviewAction,
  updateInterviewAction,
} from "../server/actions";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  candidateName: string;
}

/* ------------------------------------------------------------------ */
/* Scarto con motivazione obbligatoria                                  */
/* ------------------------------------------------------------------ */

type RejectInput = z.input<typeof changeStageSchema>;

export function RejectDialog({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  stageId,
}: DialogProps & { stageId: string }) {
  const form = useForm<RejectInput>({
    resolver: actionResolver(
      changeStageSchema.refine((value) => Boolean(value.reason), {
        message: "Indica il motivo dello scarto",
        path: ["reason"],
      }),
    ),
    defaultValues: { applicationId, stageId, reason: "" },
  });
  const mutation = useActionMutation(changeStageAction, {
    successMessage: `${candidateName}: candidatura scartata`,
    onSuccess: () => onOpenChange(false),
  });
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset({ applicationId, stageId, reason: "" });
        onOpenChange(next);
      }}
      title={`Scartare ${candidateName}?`}
      description="Lo scarto richiede sempre una motivazione: verrà registrata come valutazione di non idoneità."
      form={form}
      onSubmit={(values) => mutation.mutate(values)}
      isPending={mutation.isPending}
      submitLabel="Conferma scarto"
    >
      <TextareaField<RejectInput> name="reason" label="Motivo dello scarto" required rows={3} maxLength={1000} />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Valutazione idoneo / non idoneo / da rivalutare                      */
/* ------------------------------------------------------------------ */

type EvaluationInput = z.input<typeof evaluationSchema>;

export function EvaluationDialog({ open, onOpenChange, applicationId, candidateName }: DialogProps) {
  const defaults: EvaluationInput = { result: "SUITABLE", reason: "", notes: "" };
  const form = useForm<EvaluationInput>({ resolver: actionResolver(evaluationSchema), defaultValues: defaults });
  const result = useWatch({ control: form.control, name: "result" });
  const mutation = useActionMutation(evaluateApplicationAction, {
    successMessage: "Valutazione registrata",
    onSuccess: () => onOpenChange(false),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(defaults);
        onOpenChange(next);
      }}
      title={`Valuta ${candidateName}`}
      description="La valutazione riguarda questa candidatura, non il candidato in assoluto. Lo storico resta consultabile."
      form={form}
      onSubmit={(values) => mutation.mutate({ applicationId, values })}
      isPending={mutation.isPending}
      submitLabel="Registra valutazione"
    >
      <SelectField<EvaluationInput>
        name="result"
        label="Esito"
        required
        options={optionsOf(EVALUATION_RESULT_LABELS)}
      />
      <TextareaField<EvaluationInput>
        name="reason"
        label="Motivazione"
        required={result === "NOT_SUITABLE"}
        description={result === "NOT_SUITABLE" ? "Obbligatoria per la non idoneità." : "Facoltativa."}
        rows={3}
        maxLength={1000}
      />
      <TextareaField<EvaluationInput> name="notes" label="Note" rows={2} maxLength={2000} />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback (storico, mai sovrascritto)                                 */
/* ------------------------------------------------------------------ */

type FeedbackInput = z.input<typeof feedbackSchema>;

export function FeedbackDialog({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  interviews,
}: DialogProps & { interviews: Array<Pick<Interview, "id" | "scheduledAt" | "type">> }) {
  const defaults: FeedbackInput = {
    type: interviews.length ? "INTERVIEW" : "GENERAL",
    content: "",
    interviewId: interviews[0]?.id ?? "",
  };
  const form = useForm<FeedbackInput>({ resolver: actionResolver(feedbackSchema), defaultValues: defaults });
  const mutation = useActionMutation(addFeedbackAction, {
    successMessage: "Feedback aggiunto",
    onSuccess: () => onOpenChange(false),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(defaults);
        onOpenChange(next);
      }}
      title={`Feedback su ${candidateName}`}
      description="Ogni feedback resta nello storico della candidatura."
      form={form}
      onSubmit={(values) => mutation.mutate({ applicationId, values })}
      isPending={mutation.isPending}
      submitLabel="Aggiungi feedback"
    >
      <FieldRow>
        <SelectField<FeedbackInput> name="type" label="Tipo" required options={optionsOf(FEEDBACK_TYPE_LABELS)} />
        {interviews.length > 0 && (
          <SelectField<FeedbackInput>
            name="interviewId"
            label="Colloquio collegato"
            emptyLabel="Nessuno"
            options={interviews.map((interview) => ({
              value: interview.id,
              label: `${INTERVIEW_TYPE_LABELS[interview.type]} · ${formatDateTime(interview.scheduledAt)}`,
            }))}
          />
        )}
      </FieldRow>
      <TextareaField<FeedbackInput> name="content" label="Feedback" required rows={5} maxLength={4000} />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Colloquio: programmazione e modifica                                 */
/* ------------------------------------------------------------------ */

type InterviewInput = z.input<typeof interviewSchema>;

function defaultSlot(): string {
  return toDateTimeLocalValue(setMinutes(startOfHour(addHours(new Date(), 24)), 0));
}

export function InterviewDialog({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  interview,
  recruiters,
  defaultRecruiterId,
}: DialogProps & {
  interview?: Interview | null;
  recruiters: Array<{ id: string; displayName: string }>;
  defaultRecruiterId?: string | null;
}) {
  const defaults: InterviewInput = interview
    ? {
        scheduledAt: toDateTimeLocalValue(interview.scheduledAt),
        durationMinutes: toFormValue(interview.durationMinutes),
        type: interview.type,
        status: interview.status,
        recruiterId: toFormValue(interview.recruiterId),
        location: toFormValue(interview.location),
        meetingUrl: toFormValue(interview.meetingUrl),
        notes: toFormValue(interview.notes),
      }
    : {
        scheduledAt: defaultSlot(),
        durationMinutes: "45",
        type: "HR",
        status: "SCHEDULED",
        recruiterId: defaultRecruiterId ?? "",
        location: "",
        meetingUrl: "",
        notes: "",
      };
  const form = useForm<InterviewInput>({ resolver: actionResolver(interviewSchema), defaultValues: defaults });
  const schedule = useActionMutation(scheduleInterviewAction, {
    successMessage: "Colloquio programmato",
    onSuccess: () => onOpenChange(false),
  });
  const update = useActionMutation(updateInterviewAction, {
    successMessage: "Colloquio aggiornato",
    onSuccess: () => onOpenChange(false),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(defaults);
        onOpenChange(next);
      }}
      title={interview ? `Colloquio con ${candidateName}` : `Programma colloquio con ${candidateName}`}
      form={form}
      onSubmit={(values) =>
        interview ? update.mutate({ interviewId: interview.id, values }) : schedule.mutate({ applicationId, values })
      }
      isPending={schedule.isPending || update.isPending}
      submitLabel={interview ? "Salva" : "Programma"}
      size="lg"
    >
      <FieldRow>
        <TextField<InterviewInput> name="scheduledAt" label="Data e ora" type="datetime-local" required />
        <TextField<InterviewInput> name="durationMinutes" label="Durata (minuti)" type="number" />
      </FieldRow>
      <FieldRow>
        <SelectField<InterviewInput> name="type" label="Tipo" required options={optionsOf(INTERVIEW_TYPE_LABELS)} />
        <SelectField<InterviewInput>
          name="status"
          label="Stato"
          required
          options={optionsOf(INTERVIEW_STATUS_LABELS).filter((option) => interview || option.value === "SCHEDULED")}
        />
      </FieldRow>
      <SelectField<InterviewInput>
        name="recruiterId"
        label="Recruiter"
        emptyLabel="Non assegnato"
        options={recruiters.map((recruiter) => ({ value: recruiter.id, label: recruiter.displayName }))}
      />
      <FieldRow>
        <TextField<InterviewInput> name="location" label="Luogo" maxLength={200} />
        <TextField<InterviewInput> name="meetingUrl" label="Link videochiamata" type="url" maxLength={500} />
      </FieldRow>
      <TextareaField<InterviewInput> name="notes" label="Note organizzative" rows={2} maxLength={2000} />
    </FormDialog>
  );
}

/** Stato locale per aprire i dialog di una riga/scheda senza duplicare codice. */
export function useDialogState<T extends string>() {
  const [open, setOpen] = useState<T | null>(null);
  return {
    open,
    show: (name: T) => setOpen(name),
    props: (name: T) => ({ open: open === name, onOpenChange: (next: boolean) => setOpen(next ? name : null) }),
  };
}
