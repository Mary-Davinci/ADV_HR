"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";

import { candidateHref } from "../lib/routes";
import { identitySchema } from "../schemas/profile-schemas";
import { createCandidateAction } from "../server/actions";
import type { IdentityFormInput } from "./form-types";
import { IdentityFields } from "./identity-fields";

const EMPTY: IdentityFormInput = {
  firstName: "",
  lastName: "",
  fiscalCode: "",
  email: "",
  phone: "",
  birthDate: "",
  gender: "NOT_SPECIFIED",
};

/** Creazione rapida: solo anagrafica essenziale, il resto si completa nella scheda. */
export function CreateCandidateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<IdentityFormInput>({
    resolver: actionResolver(identitySchema),
    defaultValues: EMPTY,
  });
  const mutation = useActionMutation(createCandidateAction, {
    successMessage: "Candidato creato",
    onSuccess: ({ id }) => {
      setOpen(false);
      form.reset(EMPTY);
      router.push(candidateHref(id));
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden="true" />
        Nuovo candidato
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Nuovo candidato"
        description="Inserisci i dati anagrafici essenziali. Profilo, esperienze e competenze si completano dalla scheda."
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        submitLabel="Crea candidato"
      >
        <IdentityFields />
      </FormDialog>
    </>
  );
}
