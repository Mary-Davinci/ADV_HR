"use client";

import { CalendarCheck, ClipboardCheck, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { EVALUATION_RESULT_LABELS, INTERVIEW_TYPE_LABELS, optionsOf } from "@/config/labels";
import type { Interview, UserRef } from "@/domain";
import { EvaluationDialog, FeedbackDialog } from "@/features/recruiting/components/application-dialogs";
import { completedInterviewSchema } from "@/features/recruiting/schemas";
import { recordCompletedInterviewAction } from "@/features/recruiting/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { toDateTimeLocalValue } from "@/lib/format";

type CompletedInput = z.input<typeof completedInterviewSchema>;

export function RegisterCompletedInterviewButton({
  candidateId,
  candidateName,
  applications,
  recruiters,
  defaultRecruiterId,
  canEvaluate,
}: {
  candidateId: string;
  candidateName: string;
  applications: Array<{ id: string; label: string }>;
  recruiters: UserRef[];
  defaultRecruiterId: string | null;
  canEvaluate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const defaults = (): CompletedInput => ({
    applicationId: applications[0]?.id ?? "",
    scheduledAt: toDateTimeLocalValue(new Date()),
    durationMinutes: "",
    type: "HR",
    recruiterId: recruiters.some((item) => item.id === defaultRecruiterId) ? defaultRecruiterId! : "",
    notes: "",
    result: "",
    reason: "",
  });
  const form = useForm<CompletedInput>({
    resolver: actionResolver(completedInterviewSchema),
    defaultValues: defaults(),
  });
  const result = useWatch({ control: form.control, name: "result" });
  const mutation = useActionMutation(recordCompletedInterviewAction, {
    successMessage: "Colloquio registrato nella candidatura",
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <Button
        variant="outline"
        disabled={applications.length === 0}
        onClick={() => {
          form.reset(defaults());
          setOpen(true);
        }}
      >
        <CalendarCheck aria-hidden="true" />
        Registra colloquio svolto
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={`Registra colloquio svolto con ${candidateName}`}
        description="Indica quando si è svolto e chi lo ha condotto. Il resoconto sarà salvato nella candidatura; la data di registrazione viene aggiunta automaticamente."
        form={form}
        onSubmit={(values) => mutation.mutate({ candidateId, values })}
        isPending={mutation.isPending}
        submitLabel="Salva nello storico"
        size="lg"
      >
        <SelectField<CompletedInput>
          name="applicationId"
          label="Candidatura / posizione"
          required
          options={applications.map((item) => ({ value: item.id, label: item.label }))}
        />
        <FieldRow>
          <TextField<CompletedInput> name="scheduledAt" label="Data e ora effettive" type="datetime-local" required />
          <TextField<CompletedInput> name="durationMinutes" label="Durata (minuti)" type="number" />
        </FieldRow>
        <FieldRow>
          <SelectField<CompletedInput>
            name="recruiterId"
            label="Colloquio svolto da"
            required
            emptyLabel="Seleziona il recruiter"
            options={recruiters.map((item) => ({ value: item.id, label: item.displayName }))}
          />
          <SelectField<CompletedInput>
            name="type"
            label="Tipo di colloquio"
            required
            options={optionsOf(INTERVIEW_TYPE_LABELS)}
          />
        </FieldRow>
        <TextareaField<CompletedInput>
          name="notes"
          label="Resoconto del colloquio"
          required
          rows={4}
          maxLength={2000}
        />
        {canEvaluate && (
          <>
            <SelectField<CompletedInput>
              name="result"
              label="Esito"
              emptyLabel="Non ancora registrato"
              options={optionsOf(EVALUATION_RESULT_LABELS)}
            />
            <TextareaField<CompletedInput>
              name="reason"
              label="Motivazione dell'esito"
              required={result === "NOT_SUITABLE"}
              rows={3}
              maxLength={1000}
            />
          </>
        )}
      </FormDialog>
    </>
  );
}

export function InterviewReportActions({
  interview,
  candidateName,
  canEvaluate,
  canFeedback,
}: {
  interview: Interview;
  candidateName: string;
  canEvaluate: boolean;
  canFeedback: boolean;
}) {
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <>
      {canEvaluate && (
        <Button variant="outline" size="sm" onClick={() => setEvaluationOpen(true)}>
          <ClipboardCheck aria-hidden="true" />
          Registra esito
        </Button>
      )}
      {canFeedback && (
        <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(true)}>
          <MessageSquarePlus aria-hidden="true" />
          Feedback
        </Button>
      )}
      <EvaluationDialog
        open={evaluationOpen}
        onOpenChange={setEvaluationOpen}
        applicationId={interview.applicationId}
        candidateName={candidateName}
        interviewId={interview.id}
      />
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        applicationId={interview.applicationId}
        candidateName={candidateName}
        interviews={[interview]}
      />
    </>
  );
}
