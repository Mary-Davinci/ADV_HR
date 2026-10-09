"use client";

import { FieldRow, SelectField, TextField } from "@/components/forms/fields";
import { GENDER_LABELS, optionsOf } from "@/config/labels";

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
      <SelectField<IdentityFormInput>
        name="gender"
        label="Genere"
        required
        options={optionsOf(GENDER_LABELS)}
        className="sm:max-w-xs"
      />
    </>
  );
}
