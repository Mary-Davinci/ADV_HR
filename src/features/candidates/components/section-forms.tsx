"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField, TextField, TriStateField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import {
  AVAILABILITY_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  optionsOf,
  PROTECTED_CATEGORY_LABELS,
  WORK_MODE_LABELS,
  WORK_TIME_LABELS,
} from "@/config/labels";
import type { Candidate, CandidatePreferences, CandidateProfile } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";
import type { ActionResult } from "@/lib/action-result";
import { actionResolver } from "@/lib/forms";
import { toFormValue } from "@/lib/zod-helpers";

import { identitySchema, preferencesSchema, profileSchema } from "../schemas/profile-schemas";
import { updateIdentityAction, updatePreferencesAction, updateProfileAction } from "../server/actions";
import type { IdentityFormInput, PreferencesFormInput, ProfileFormInput } from "./form-types";
import { IdentityFields } from "./identity-fields";

interface EditSectionProps<TSchema extends z.ZodType<unknown, FieldValues>> {
  candidateId: string;
  title: string;
  description?: string;
  schema: TSchema;
  initialValues: z.input<TSchema>;
  action: (input: { candidateId: string; values: z.input<TSchema> }) => Promise<ActionResult<void>>;
  children: React.ReactNode;
}

function EditSectionButton<TSchema extends z.ZodType<unknown, FieldValues>>({
  candidateId,
  title,
  description,
  schema,
  initialValues,
  action,
  children,
}: EditSectionProps<TSchema>) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.input<TSchema>>({ resolver: actionResolver(schema), defaultValues: initialValues as never });
  const mutation = useActionMutation(action, { successMessage: "Modifiche salvate", onSuccess: () => setOpen(false) });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          form.reset(initialValues as never);
          setOpen(true);
        }}
      >
        <Pencil aria-hidden="true" />
        Modifica
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        form={form}
        onSubmit={(values) => mutation.mutate({ candidateId, values })}
        isPending={mutation.isPending}
        size="lg"
      >
        {children}
      </FormDialog>
    </>
  );
}

export function EditIdentityButton({ candidate }: { candidate: Candidate }) {
  const initialValues: IdentityFormInput = {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    fiscalCode: toFormValue(candidate.fiscalCode),
    email: toFormValue(candidate.email),
    phone: toFormValue(candidate.phone),
    birthDate: toFormValue(candidate.birthDate),
    gender: candidate.gender,
  };
  return (
    <EditSectionButton
      candidateId={candidate.id}
      title="Modifica anagrafica"
      schema={identitySchema}
      initialValues={initialValues}
      action={updateIdentityAction}
    >
      <IdentityFields />
    </EditSectionButton>
  );
}

export function EditProfileButton({ profile }: { profile: CandidateProfile }) {
  const initialValues: ProfileFormInput = {
    residenceAddress: toFormValue(profile.residenceAddress),
    residenceCity: toFormValue(profile.residenceCity),
    residenceProvince: toFormValue(profile.residenceProvince),
    residenceRegion: toFormValue(profile.residenceRegion),
    residenceCountry: toFormValue(profile.residenceCountry),
    protectedCategory: profile.protectedCategory,
    protectedCategoryNotes: toFormValue(profile.protectedCategoryNotes),
    employmentStatus: profile.employmentStatus,
    professionalSummary: toFormValue(profile.professionalSummary),
  };
  return (
    <EditSectionButton
      candidateId={profile.candidateId}
      title="Modifica profilo"
      description="Residenza, situazione occupazionale, categoria protetta e sintesi professionale."
      schema={profileSchema}
      initialValues={initialValues}
      action={updateProfileAction}
    >
      <TextareaField<ProfileFormInput>
        name="professionalSummary"
        label="Sintesi professionale"
        description="Poche righe su ruolo, esperienza e punti di forza."
        maxLength={4000}
      />
      <FieldRow>
        <SelectField<ProfileFormInput>
          name="employmentStatus"
          label="Stato occupazionale"
          required
          options={optionsOf(EMPLOYMENT_STATUS_LABELS)}
        />
        <SelectField<ProfileFormInput>
          name="protectedCategory"
          label="Categoria protetta (L. 68/99)"
          required
          options={optionsOf(PROTECTED_CATEGORY_LABELS)}
        />
      </FieldRow>
      <TextareaField<ProfileFormInput>
        name="protectedCategoryNotes"
        label="Note categoria protetta"
        description="Solo informazioni necessarie alla selezione (es. adattamenti della postazione)."
        rows={2}
        maxLength={1000}
      />
      <TextField<ProfileFormInput> name="residenceAddress" label="Indirizzo di residenza" maxLength={200} />
      <FieldRow columns={3}>
        <TextField<ProfileFormInput> name="residenceCity" label="Città" maxLength={100} />
        <TextField<ProfileFormInput> name="residenceProvince" label="Provincia" maxLength={2} />
        <TextField<ProfileFormInput> name="residenceRegion" label="Regione" maxLength={60} />
      </FieldRow>
      <TextField<ProfileFormInput> name="residenceCountry" label="Paese (ISO)" maxLength={2} className="sm:max-w-40" />
    </EditSectionButton>
  );
}

export function EditPreferencesButton({ preferences }: { preferences: CandidatePreferences }) {
  const initialValues: PreferencesFormInput = {
    availability: preferences.availability ?? "",
    desiredEmploymentType: preferences.desiredEmploymentType ?? "",
    desiredWorkTime: preferences.desiredWorkTime ?? "",
    desiredWorkMode: preferences.desiredWorkMode ?? "",
    willingToRelocate: preferences.willingToRelocate === null ? "" : preferences.willingToRelocate ? "true" : "false",
    willingToTravel: preferences.willingToTravel === null ? "" : preferences.willingToTravel ? "true" : "false",
    preferredLocations: preferences.preferredLocations.join(", "),
    availabilityNotes: toFormValue(preferences.availabilityNotes),
  };
  return (
    <EditSectionButton
      candidateId={preferences.candidateId}
      title="Modifica preferenze"
      schema={preferencesSchema}
      initialValues={initialValues}
      action={updatePreferencesAction}
    >
      <FieldRow>
        <SelectField<PreferencesFormInput>
          name="availability"
          label="Disponibilità"
          options={optionsOf(AVAILABILITY_LABELS)}
        />
        <SelectField<PreferencesFormInput>
          name="desiredWorkMode"
          label="Modalità di lavoro"
          options={optionsOf(WORK_MODE_LABELS)}
        />
      </FieldRow>
      <FieldRow>
        <SelectField<PreferencesFormInput>
          name="desiredEmploymentType"
          label="Tipologia contratto desiderata"
          options={optionsOf(WORK_TIME_LABELS)}
        />
        <SelectField<PreferencesFormInput>
          name="desiredWorkTime"
          label="Orario desiderato"
          options={optionsOf(WORK_TIME_LABELS)}
        />
      </FieldRow>
      <FieldRow>
        <TriStateField<PreferencesFormInput> name="willingToRelocate" label="Disponibile al trasferimento" />
        <TriStateField<PreferencesFormInput> name="willingToTravel" label="Disponibile a trasferte" />
      </FieldRow>
      <TextField<PreferencesFormInput>
        name="preferredLocations"
        label="Sedi preferite"
        description="Separate da virgola, es. Milano, Bergamo"
        maxLength={500}
      />
      <TextareaField<PreferencesFormInput>
        name="availabilityNotes"
        label="Note sulla disponibilità"
        rows={2}
        maxLength={1000}
      />
    </EditSectionButton>
  );
}
