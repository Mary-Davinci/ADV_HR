"use client";

import { PhoneCall } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { SelectField, TextareaField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { CONTACT_ACTION_LABELS, optionsOf } from "@/config/labels";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";

import { contactSchema } from "../schemas/profile-schemas";
import { logContactAction } from "../server/actions";

type ContactFormInput = z.input<typeof contactSchema>;

/**
 * Registra un contatto con il candidato. "Ultimo contatto" è sempre DERIVATO
 * da questi eventi: non esiste un campo compilabile a mano.
 */
export function LogContactButton({
  candidateId,
  applications,
}: {
  candidateId: string;
  applications: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const defaults: ContactFormInput = { action: "PHONE_CALL", note: "", applicationId: applications[0]?.id ?? "" };
  const form = useForm<ContactFormInput>({ resolver: actionResolver(contactSchema), defaultValues: defaults });
  const mutation = useActionMutation(logContactAction, {
    successMessage: "Contatto registrato",
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          form.reset(defaults);
          setOpen(true);
        }}
      >
        <PhoneCall aria-hidden="true" />
        Registra contatto
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Registra contatto"
        description="Aggiorna l'ultimo contatto e la timeline del candidato."
        form={form}
        onSubmit={(values) => mutation.mutate({ candidateId, values })}
        isPending={mutation.isPending}
        submitLabel="Registra"
      >
        <SelectField<ContactFormInput>
          name="action"
          label="Tipo di contatto"
          required
          options={optionsOf(CONTACT_ACTION_LABELS).filter((option) => option.value !== "INTERVIEW")}
        />
        {applications.length > 0 && (
          <SelectField<ContactFormInput>
            name="applicationId"
            label="Relativo alla candidatura"
            options={applications.map((application) => ({ value: application.id, label: application.label }))}
            emptyLabel="Nessuna in particolare"
          />
        )}
        <TextareaField<ContactFormInput> name="note" label="Nota" rows={3} maxLength={1000} />
      </FormDialog>
    </>
  );
}
