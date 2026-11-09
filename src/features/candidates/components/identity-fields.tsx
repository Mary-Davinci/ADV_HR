"use client";

import { FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { GENDER_LABELS, optionsOf, RESIDENCE_PERMIT_STATUS_LABELS } from "@/config/labels";

import type { IdentityFormInput } from "./form-types";

/** Campi anagrafici condivisi tra creazione e modifica del candidato. */
export function IdentityFields() {
  return (
    <>
      <FieldRow>
        <TextField<IdentityFormInput> name="firstName" label="Nome" required autoComplete="off" maxLength={100} />
        <TextField<IdentityFormInput> name="lastName" label="Cognome" required autoComplete="off" maxLength={100} />
      </FieldRow>
      <FieldRow>
        <TextField<IdentityFormInput>
          name="fiscalCode"
          label="Codice fiscale"
          maxLength={16}
          description="16 caratteri, verificato nel formato"
        />
        <TextField<IdentityFormInput> name="birthDate" label="Data di nascita" type="date" />
      </FieldRow>
      <FieldRow>
        <TextField<IdentityFormInput> name="email" label="Email" type="email" maxLength={254} />
        <TextField<IdentityFormInput> name="phone" label="Telefono" type="tel" maxLength={40} />
      </FieldRow>
      <FieldRow>
        <SelectField<IdentityFormInput> name="gender" label="Genere" required options={optionsOf(GENDER_LABELS)} />
        <TextField<IdentityFormInput> name="nationality" label="Nazionalità" maxLength={60} />
      </FieldRow>
      <FieldRow>
        <SelectField<IdentityFormInput>
          name="residencePermitStatus"
          label="Permesso di soggiorno"
          options={optionsOf(RESIDENCE_PERMIT_STATUS_LABELS)}
        />
        <TextField<IdentityFormInput> name="residencePermitExpiresOn" label="Scadenza del permesso" type="date" />
      </FieldRow>
      <TextareaField<IdentityFormInput>
        name="residencePermitNotes"
        label="Motivo o note sul permesso"
        description="Ad esempio il motivo se il permesso manca o è stato negato."
        rows={2}
        maxLength={500}
      />
    </>
  );
}
