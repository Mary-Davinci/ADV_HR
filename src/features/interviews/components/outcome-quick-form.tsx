"use client";

import { Loader2, Save } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { EVALUATION_RESULT_LABELS, INTERVIEW_TYPE_LABELS, optionsOf } from "@/config/labels";
import type { UserRef } from "@/domain";
import { completedInterviewSchema } from "@/features/recruiting/schemas";
import { recordCompletedInterviewAction } from "@/features/recruiting/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { toDateTimeLocalValue } from "@/lib/format";

type CompletedInput = z.input<typeof completedInterviewSchema>;

/**
 * Esito di una chiamata o di un colloquio appena fatti, compilato direttamente nella
 * candidatura: registra un colloquio svolto adesso, con resoconto ed esito, nello storico.
 */
export function OutcomeQuickForm({
  candidateId,
  applicationId,
  recruiters,
  defaultRecruiterId,
  canEvaluate,
}: {
  candidateId: string;
  applicationId: string;
  recruiters: UserRef[];
  defaultRecruiterId: string | null;
  canEvaluate: boolean;
}) {
  const knownRecruiter = recruiters.some((item) => item.id === defaultRecruiterId);
  const defaults = (): CompletedInput => ({
    applicationId,
    scheduledAt: toDateTimeLocalValue(new Date()),
    durationMinutes: "",
    type: "SCREENING",
    recruiterId: knownRecruiter ? defaultRecruiterId! : "",
    notes: "",
    result: "",
    reason: "",
  });
  const form = useForm<CompletedInput>({
    resolver: actionResolver(completedInterviewSchema),
    defaultValues: defaults(),
  });
  const result = useWatch({ control: form.control, name: "result" });
  const save = useActionMutation(recordCompletedInterviewAction, {
    successMessage: "Esito salvato nello storico",
    onSuccess: () => form.reset(defaults()),
  });

  return (
    <FormProvider {...form}>
      <form
        noValidate
        className="space-y-3"
        aria-label="Registra l'esito di una chiamata o di un colloquio"
        onSubmit={form.handleSubmit((values) =>
          save.mutate({ candidateId, values: { ...values, scheduledAt: toDateTimeLocalValue(new Date()) } }),
        )}
      >
        <FieldRow>
          <SelectField<CompletedInput>
            name="type"
            label="Contatto"
            required
            options={optionsOf(INTERVIEW_TYPE_LABELS)}
          />
          {canEvaluate && (
            <SelectField<CompletedInput>
              name="result"
              label="Esito"
              emptyLabel="Nessun esito"
              options={optionsOf(EVALUATION_RESULT_LABELS)}
            />
          )}
        </FieldRow>
        {!knownRecruiter && (
          <SelectField<CompletedInput>
            name="recruiterId"
            label="Svolto da"
            required
            emptyLabel="Seleziona il recruiter"
            options={recruiters.map((item) => ({ value: item.id, label: item.displayName }))}
          />
        )}
        <TextareaField<CompletedInput> name="notes" label="Com'è andata" required rows={3} maxLength={2000} />
        {canEvaluate && result === "NOT_SUITABLE" && (
          <TextareaField<CompletedInput>
            name="reason"
            label="Motivo della non idoneità"
            required
            rows={2}
            maxLength={1000}
          />
        )}
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
          Salva esito
        </Button>
      </form>
    </FormProvider>
  );
}
