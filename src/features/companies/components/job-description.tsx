"use client";

import { FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { labelOf, optionsOf, WORK_MODE_LABELS, WORK_TIME_LABELS } from "@/config/labels";
import type { JobDescription } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { EMPTY_VALUE, formatCurrency, formatDateTime } from "@/lib/format";
import { toFormValue } from "@/lib/zod-helpers";

import { jobDescriptionSchema } from "../schemas";
import { saveJobDescriptionAction } from "../server/actions";

type JobDescriptionInput = z.input<typeof jobDescriptionSchema>;

function toForm(jd: JobDescription | null, fallbackTitle: string): JobDescriptionInput {
  return {
    title: jd?.title ?? fallbackTitle,
    summary: toFormValue(jd?.summary),
    duties: toFormValue(jd?.duties),
    requirements: toFormValue(jd?.requirements),
    employmentType: jd?.employmentType ?? "",
    workTime: jd?.workTime ?? "",
    workMode: jd?.workMode ?? "",
    salaryMin: toFormValue(jd?.salaryMin),
    salaryMax: toFormValue(jd?.salaryMax),
    currency: jd?.currency ?? "EUR",
    workingHours: toFormValue(jd?.workingHours),
    locationCity: toFormValue(jd?.locationCity),
    locationProvince: toFormValue(jd?.locationProvince),
    locationRegion: toFormValue(jd?.locationRegion),
    notes: toFormValue(jd?.notes),
  };
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h4>
      <div className={empty ? "text-sm text-muted-foreground" : "text-sm leading-relaxed whitespace-pre-line"}>
        {empty ? EMPTY_VALUE : children}
      </div>
    </div>
  );
}

/**
 * Job description della selezione: vista leggibile + editor in dialog ampio.
 * Nessuna generazione automatica (AI) in V1.
 */
export function JobDescriptionCard({
  selectionId,
  selectionTitle,
  jobDescription,
  canEdit,
}: {
  selectionId: string;
  selectionTitle: string;
  jobDescription: JobDescription | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<JobDescriptionInput>({
    resolver: actionResolver(jobDescriptionSchema),
    defaultValues: toForm(jobDescription, selectionTitle),
  });
  const mutation = useActionMutation(saveJobDescriptionAction, {
    successMessage: "Job description salvata",
    onSuccess: () => setOpen(false),
  });
  const jd = jobDescription;
  const salary =
    jd && (jd.salaryMin !== null || jd.salaryMax !== null)
      ? [jd.salaryMin, jd.salaryMax]
          .map((value) => (value === null ? null : formatCurrency(value, jd.currency ?? "EUR")))
          .filter(Boolean)
          .join(" – ") + " lordi annui"
      : null;
  const location = jd
    ? [jd.locationCity, jd.locationProvince && `(${jd.locationProvince})`, jd.locationRegion].filter(Boolean).join(" ")
    : "";

  return (
    <Card role="region" aria-labelledby="jd-heading">
      <CardHeader>
        <h3 id="jd-heading" className="flex items-center gap-2 text-base font-medium">
          <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
          {jd?.title ?? "Job description"}
        </h3>
        {canEdit && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                form.reset(toForm(jobDescription, selectionTitle));
                setOpen(true);
              }}
            >
              <Pencil aria-hidden="true" />
              {jd?.summary || jd?.duties ? "Modifica" : "Compila"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Block label="Sintesi">{jd?.summary}</Block>
          <Block label="Mansioni">{jd?.duties}</Block>
          <Block label="Requisiti">{jd?.requirements}</Block>
          <Block label="Note">{jd?.notes}</Block>
        </div>
        <dl className="grid content-start gap-4 rounded-lg bg-muted/40 p-4">
          <div>
            <dt className="text-xs text-muted-foreground">Contratto</dt>
            <dd className="text-sm">{labelOf(WORK_TIME_LABELS, jd?.employmentType)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Orario</dt>
            <dd className="text-sm">{jd?.workingHours ?? labelOf(WORK_TIME_LABELS, jd?.workTime)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Modalità di lavoro</dt>
            <dd className="text-sm">{labelOf(WORK_MODE_LABELS, jd?.workMode)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Retribuzione</dt>
            <dd className="text-sm">{salary ?? EMPTY_VALUE}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sede</dt>
            <dd className="text-sm">{location || EMPTY_VALUE}</dd>
          </div>
          {jd && (
            <div>
              <dt className="text-xs text-muted-foreground">Ultimo aggiornamento</dt>
              <dd className="text-sm">{formatDateTime(jd.updatedAt)}</dd>
            </div>
          )}
        </dl>
      </CardContent>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Job description"
        description="Descrivi la posizione in modo chiaro: sarà la base per la valutazione dei candidati."
        form={form}
        onSubmit={(values) => mutation.mutate({ selectionId, values })}
        isPending={mutation.isPending}
        size="xl"
      >
        <TextField<JobDescriptionInput> name="title" label="Titolo" required maxLength={200} />
        <TextareaField<JobDescriptionInput> name="summary" label="Sintesi" rows={3} maxLength={2000} />
        <TextareaField<JobDescriptionInput>
          name="duties"
          label="Mansioni"
          rows={5}
          maxLength={6000}
          description="Una mansione per riga."
        />
        <TextareaField<JobDescriptionInput>
          name="requirements"
          label="Requisiti"
          rows={5}
          maxLength={6000}
          description="Un requisito per riga."
        />
        <FieldRow columns={3}>
          <SelectField<JobDescriptionInput>
            name="employmentType"
            label="Contratto"
            options={optionsOf(WORK_TIME_LABELS)}
          />
          <SelectField<JobDescriptionInput> name="workTime" label="Orario" options={optionsOf(WORK_TIME_LABELS)} />
          <SelectField<JobDescriptionInput>
            name="workMode"
            label="Modalità di lavoro"
            options={optionsOf(WORK_MODE_LABELS)}
          />
        </FieldRow>
        <TextField<JobDescriptionInput>
          name="workingHours"
          label="Dettaglio orario"
          maxLength={200}
          placeholder="es. 9-13 / 14-18"
        />
        <FieldRow columns={3}>
          <TextField<JobDescriptionInput> name="salaryMin" label="RAL minima" type="number" />
          <TextField<JobDescriptionInput> name="salaryMax" label="RAL massima" type="number" />
          <TextField<JobDescriptionInput> name="currency" label="Valuta" maxLength={3} />
        </FieldRow>
        <FieldRow columns={3}>
          <TextField<JobDescriptionInput> name="locationCity" label="Città" maxLength={100} />
          <TextField<JobDescriptionInput> name="locationProvince" label="Provincia" maxLength={2} />
          <TextField<JobDescriptionInput> name="locationRegion" label="Regione" maxLength={60} />
        </FieldRow>
        <TextareaField<JobDescriptionInput> name="notes" label="Note" rows={2} maxLength={2000} />
      </FormDialog>
    </Card>
  );
}
