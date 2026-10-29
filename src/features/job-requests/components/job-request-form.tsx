"use client";

import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useId } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";

import { CheckboxField, FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EXPERIENCE_LEVEL_LABELS,
  HIRING_DOCUMENT_LABELS,
  HIRING_INCENTIVE_LABELS,
  JOB_CONTRACT_TYPE_LABELS,
  optionsOf,
  WORK_DAY_LABELS,
} from "@/config/labels";
import type { JobRequestFormValues } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";
import type { ActionResult } from "@/lib/action-result";

import { FIELD_LIMITS, jobRequestFormSchema } from "../schemas";
import { completeJobRequestAction, saveJobRequestDraftAction } from "../server/actions";

type Values = JobRequestFormValues;

/**
 * Modulo bloccato (non in bozza o salvataggio in corso). Serve passarlo
 * esplicitamente: caselle e select Base UI non ereditano il disabled del fieldset.
 */
const LockedContext = createContext(false);

const YES_NO = [
  { value: "true", label: "Sì" },
  { value: "false", label: "No" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <Card role="region" aria-labelledby={id}>
      <CardHeader>
        <h2 id={id} className="text-base leading-snug font-medium">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Gruppo di caselle per i campi a scelta multipla (giorni, agevolazioni, documenti). */
function CheckboxGroupField<T extends string>({
  name,
  legend,
  options,
  required,
}: {
  name: Path<Values>;
  legend: string;
  options: Array<{ value: T; label: string }>;
  required?: boolean;
}) {
  const { control } = useFormContext<Values>();
  const locked = useContext(LockedContext);
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = (field.value as T[] | undefined) ?? [];
        return (
          <fieldset
            className="space-y-2"
            aria-invalid={Boolean(fieldState.error)}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
          >
            <legend className="mb-2 text-sm font-medium">
              {legend}
              {required && (
                <span aria-hidden="true" className="ml-1 text-destructive">
                  *
                </span>
              )}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {options.map((option) => (
                <label key={option.value} className="flex items-start gap-2.5 text-sm leading-snug">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.includes(option.value)}
                    disabled={locked}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked === true
                          ? options.map((o) => o.value).filter((v) => v === option.value || selected.includes(v))
                          : selected.filter((value) => value !== option.value),
                      )
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {fieldState.error && (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </fieldset>
        );
      }}
    />
  );
}

function useConditionalFields() {
  const { control } = useFormContext<Values>();
  const [contractType, smartWorking, incentives, documents] = useWatch({
    control,
    name: ["contract.type", "contract.smartWorking", "incentives.types", "documents.required"],
  });
  return { contractType, smartWorking, incentives, documents };
}

function FormSections() {
  const { contractType, smartWorking, incentives, documents } = useConditionalFields();
  const locked = useContext(LockedContext);
  const text = (
    name: Path<Values>,
    label: string,
    max: number,
    extra: Omit<Partial<React.ComponentProps<typeof TextField<Values>>>, "name" | "label"> = {},
  ) => <TextField<Values> name={name} label={label} maxLength={max} autoComplete="off" {...extra} />;

  return (
    <div className="space-y-6">
      <Section title="Dati azienda" description="Intestazione del modulo: dati fiscali e referente della selezione.">
        <FieldRow>
          {text("company.name", "Ragione sociale", FIELD_LIMITS.name, { required: true })}
          {text("company.vatOrFiscalCode", "Partita IVA / C.F.", FIELD_LIMITS.vatOrFiscalCode, {
            required: true,
            description: "Partita IVA verificata con la cifra di controllo",
          })}
        </FieldRow>
        {text("company.registeredOffice", "Sede legale", FIELD_LIMITS.registeredOffice, {
          required: true,
          placeholder: "Via, numero civico, CAP, città (provincia)",
        })}
        {text("company.operatingOffice", "Sede operativa", FIELD_LIMITS.operatingOffice, {
          description: "Se diversa dalla sede legale",
        })}
        <FieldRow>
          {text("company.phone", "Telefono", FIELD_LIMITS.phone, { required: true, type: "tel" })}
          {text("company.adminEmail", "Email amministrazione", FIELD_LIMITS.adminEmail, {
            required: true,
            type: "email",
          })}
        </FieldRow>
        <FieldRow>
          {text("company.pec", "PEC", FIELD_LIMITS.pec, { required: true, type: "email" })}
          {text("company.sdiCode", "Codice SDI", FIELD_LIMITS.sdiCode, { required: true, description: "7 caratteri" })}
        </FieldRow>
        {text("company.contactName", "Referente selezione del personale", FIELD_LIMITS.contactName, { required: true })}
        <FieldRow>
          {text("company.contactEmail", "Email del referente", FIELD_LIMITS.contactEmail, {
            required: true,
            type: "email",
          })}
          {text("company.contactPhone", "Telefono del referente", FIELD_LIMITS.contactPhone, {
            required: true,
            type: "tel",
          })}
        </FieldRow>
      </Section>

      <Section title="Profilo ricercato">
        <FieldRow columns={3}>
          <div className="sm:col-span-2">{text("profile.role", "Ruolo", FIELD_LIMITS.role, { required: true })}</div>
          {text("profile.positions", "Numero lavoratori richiesti", 3, { required: true, type: "number" })}
        </FieldRow>
        <FieldRow columns={3}>
          <SelectField<Values>
            disabled={locked}
            name="profile.experience"
            label="Esperienza richiesta"
            required
            options={optionsOf(EXPERIENCE_LEVEL_LABELS)}
          />
          {text("profile.city", "Luogo di lavoro (città)", FIELD_LIMITS.city, { required: true })}
          <FieldRow>
            {text("profile.province", "Provincia", 2, { required: true, placeholder: "es. BG" })}
            <SelectField<Values> disabled={locked} name="profile.travel" label="Trasferte" required options={YES_NO} />
          </FieldRow>
        </FieldRow>
        {text("profile.duties", "Mansionario sintetico", FIELD_LIMITS.duties, { required: true })}
        {text("profile.activities", "Descrizione sintetica attività", FIELD_LIMITS.activities, { required: true })}
        <FieldRow columns={3}>
          <div className="sm:col-span-2">{text("profile.education", "Istruzione", FIELD_LIMITS.education)}</div>
          {text("profile.drivingLicense", "Patente", FIELD_LIMITS.drivingLicense)}
        </FieldRow>
        {text("profile.certifications", "Certificazioni", FIELD_LIMITS.certifications)}
        {text("profile.mandatoryRequirements", "Requisiti indispensabili", FIELD_LIMITS.mandatoryRequirements)}
        <div className="sm:max-w-xs">
          {text("profile.expectedHireDate", "Data prevista assunzione", 10, { type: "date" })}
        </div>
      </Section>

      <Section title="Tipologia contratto">
        <FieldRow columns={3}>
          <SelectField<Values>
            disabled={locked}
            name="contract.type"
            label="Tipologia"
            required
            options={optionsOf(JOB_CONTRACT_TYPE_LABELS)}
          />
          {contractType === "FIXED_TERM" &&
            text("contract.fixedTermMonths", "Durata (mesi)", 2, { required: true, type: "number" })}
          {contractType === "OTHER" &&
            text("contract.otherType", "Specifica la tipologia", FIELD_LIMITS.otherType, { required: true })}
        </FieldRow>
        <FieldRow>
          {text("contract.ccnl", "CCNL", FIELD_LIMITS.ccnl)}
          {text("contract.level", "Livello / categoria di inquadramento", FIELD_LIMITS.level)}
        </FieldRow>
        <FieldRow>
          {text("contract.monthlySalary", "Range retribuzione mensile", FIELD_LIMITS.monthlySalary, {
            placeholder: "es. 1.600 - 1.750 € netti",
          })}
          {text("contract.annualSalary", "Range RAL", FIELD_LIMITS.annualSalary, {
            placeholder: "es. 24.000 - 26.000 €",
          })}
        </FieldRow>
        {text("contract.benefits", "Benefit", FIELD_LIMITS.benefits)}
        <FieldRow columns={3}>
          <SelectField<Values>
            disabled={locked}
            name="contract.schedule"
            label="Orario"
            required
            options={[
              { value: "FULL", label: "Tempo pieno" },
              { value: "PART", label: "Tempo parziale" },
            ]}
          />
          <FieldRow>
            {text("contract.from", "Dalle", 5, { required: true, type: "time" })}
            {text("contract.to", "Alle", 5, { required: true, type: "time" })}
          </FieldRow>
          {text("contract.weeklyHours", "Ore settimanali", 2, { required: true, type: "number" })}
        </FieldRow>
        <CheckboxGroupField
          name="contract.days"
          legend="Giorni lavorativi"
          required
          options={optionsOf(WORK_DAY_LABELS)}
        />
        <FieldRow columns={3}>
          <SelectField<Values>
            disabled={locked}
            name="contract.holidayWork"
            label="Lavoro festivo"
            required
            options={YES_NO}
          />
        </FieldRow>
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Tipologia di lavoro
            <span aria-hidden="true" className="ml-1 text-destructive">
              *
            </span>
          </p>
          <div className="flex flex-wrap gap-6">
            <CheckboxField<Values> disabled={locked} name="contract.onSite" label="In azienda" />
            <CheckboxField<Values> disabled={locked} name="contract.smartWorking" label="Smart working" />
          </div>
          <OnSiteError />
          {smartWorking &&
            text("contract.smartWorkingDays", "Giorni di smart working", FIELD_LIMITS.smartWorkingDays, {
              required: true,
              placeholder: "es. martedì e giovedì",
            })}
        </div>
      </Section>

      <Section title="Assunzioni agevolate">
        <CheckboxGroupField
          name="incentives.types"
          legend="Agevolazioni"
          options={optionsOf(HIRING_INCENTIVE_LABELS)}
        />
        {incentives?.includes("OTHER") &&
          text("incentives.other", "Altra agevolazione", FIELD_LIMITS.incentiveOther, { required: true })}
        {text("incentives.expectedHireMonth", "Mese previsto assunzione", FIELD_LIMITS.expectedHireMonth)}
        <TextareaField<Values> name="incentives.notes" label="Note" rows={2} maxLength={FIELD_LIMITS.incentiveNotes} />
      </Section>

      <Section title="Documentazione da richiedere ai fini dell'assunzione">
        <CheckboxGroupField name="documents.required" legend="Documenti" options={optionsOf(HIRING_DOCUMENT_LABELS)} />
        {documents?.includes("OTHER") &&
          text("documents.other", "Altro documento", FIELD_LIMITS.documentOther, { required: true })}
      </Section>

      <Section title="Note aggiuntive azienda">
        <TextareaField<Values> name="companyNotes" label="Note" rows={4} maxLength={FIELD_LIMITS.companyNotes} />
      </Section>

      <Section
        title="Consenso al trattamento dati personali"
        description="Il legale rappresentante presta il consenso ai sensi del GDPR 679/2016: senza consenso la richiesta non è valida."
      >
        {text("consent.signatoryName", "Il/La sottoscritto/a (legale rappresentante)", FIELD_LIMITS.signatoryName, {
          required: true,
        })}
        <CheckboxField<Values>
          disabled={locked}
          name="consent.granted"
          label="Il legale rappresentante dà il consenso"
        />
        <ConsentError />
      </Section>
    </div>
  );
}

function FieldErrorText({ name }: { name: Path<Values> }) {
  const { getFieldState, formState } = useFormContext<Values>();
  const error = getFieldState(name, formState).error;
  return error ? <p className="text-sm text-destructive">{error.message}</p> : null;
}

const OnSiteError = () => <FieldErrorText name="contract.onSite" />;
const ConsentError = () => <FieldErrorText name="consent.granted" />;

interface FormTexts {
  submitLabel: string;
  submitSuccess: string;
}

/**
 * Modulo Job Description, indipendente da chi salva: HR (azioni con sessione)
 * o azienda (azioni con token). Le regole di validazione sono le stesse.
 */
export function JobRequestFormBase({
  initialValues,
  editable,
  save,
  submit,
  texts,
  onSubmitted,
}: {
  initialValues: Values;
  editable: boolean;
  save: (values: Values) => Promise<ActionResult<void>>;
  submit: (values: Values) => Promise<ActionResult<void>>;
  texts: FormTexts;
  onSubmitted: () => void;
}) {
  const form = useForm<Values>({ defaultValues: initialValues });
  const saveMutation = useActionMutation(save, {
    successMessage: "Bozza salvata",
    onSuccess: () => form.reset(form.getValues()),
  });
  const submitMutation = useActionMutation(submit, {
    successMessage: texts.submitSuccess,
    errorTitle: "Modulo non inviato",
    onSuccess: onSubmitted,
  });
  const pending = saveMutation.isPending || submitMutation.isPending;

  function markComplete() {
    form.clearErrors();
    const values = form.getValues();
    const result = jobRequestFormSchema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        form.setError(issue.path.join(".") as Path<Values>, { type: "validate", message: issue.message });
      }
      const count = result.error.issues.length;
      toast.error("Il modulo non è completo", {
        description: `${count} ${count === 1 ? "campo da sistemare" : "campi da sistemare"}: sono evidenziati in rosso.`,
      });
      const first = result.error.issues[0]?.path.join(".");
      if (first) form.setFocus(first as Path<Values>);
      return;
    }
    submitMutation.mutate(values);
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate(form.getValues());
        }}
        className="space-y-6"
      >
        <fieldset disabled={!editable || pending} className="min-w-0">
          <LockedContext value={!editable || pending}>
            <FormSections />
          </LockedContext>
        </fieldset>
        {editable && (
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:justify-end">
            <Button type="submit" variant="outline" disabled={pending}>
              {saveMutation.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Salva bozza
            </Button>
            <Button type="button" onClick={markComplete} disabled={pending}>
              {submitMutation.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {texts.submitLabel}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}

/** Versione HR (compilazione interna, es. dati dettati al telefono). */
export function JobRequestForm({
  requestId,
  initialValues,
  editable,
}: {
  requestId: string;
  initialValues: Values;
  editable: boolean;
}) {
  const router = useRouter();
  return (
    <JobRequestFormBase
      initialValues={initialValues}
      editable={editable}
      save={(values) => saveJobRequestDraftAction({ requestId, values })}
      submit={(values) => completeJobRequestAction({ requestId, values })}
      texts={{ submitLabel: "Segna come completa", submitSuccess: "Richiesta completa: il PDF da firmare è pronto" }}
      onSubmitted={() => router.refresh()}
    />
  );
}
