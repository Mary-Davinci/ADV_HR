"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { Candidate } from "@/domain";
import { useForm } from "react-hook-form";

import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";

import { candidateHref } from "../lib/routes";
import { identitySchema } from "../schemas/profile-schemas";
import { createCandidateAction, findDuplicateCandidatesAction } from "../server/actions";
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
  nationality: "",
  residencePermitStatus: "",
  residencePermitExpiresOn: "",
  residencePermitNotes: "",
};

/** Creazione rapida: solo anagrafica essenziale, il resto si completa nella scheda. */
export function CreateCandidateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{ candidate: Candidate; reasons: string[] }>>([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const form = useForm<IdentityFormInput>({
    resolver: actionResolver(identitySchema),
    defaultValues: EMPTY,
  });
  const check = useActionMutation<
    IdentityFormInput,
    { id: string } | { duplicates: Array<{ candidate: Candidate; reasons: string[] }> }
  >(
    async (values) => {
      const result = await findDuplicateCandidatesAction(values);
      if (result.ok && (result.data.length === 0 || allowDuplicate))
        return createCandidateAction({ ...values, allowDuplicate });
      return result.ok ? { ok: true as const, data: { duplicates: result.data } } : result;
    },
    {
      onSuccess: (data) => {
        if ("duplicates" in data) {
          setDuplicates(data.duplicates);
          setAllowDuplicate(false);
        } else {
          setOpen(false);
          form.reset(EMPTY);
          router.push(candidateHref(data.id));
        }
      },
    },
  );

  return (
    <>
      <Button
        onClick={() => {
          setDuplicates([]);
          setAllowDuplicate(false);
          setOpen(true);
        }}
      >
        <UserPlus aria-hidden="true" />
        Nuovo candidato
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Nuovo candidato"
        description="Inserisci i dati anagrafici essenziali. Profilo, esperienze e competenze si completano dalla scheda."
        form={form}
        onSubmit={(values) => check.mutate(values)}
        isPending={check.isPending}
        submitLabel="Crea candidato"
      >
        <IdentityFields />
        {duplicates.length > 0 && (
          <div role="alert" className="space-y-3 rounded-lg border border-amber-300 p-3 text-sm">
            <p className="font-medium">
              Possibili schede già presenti: controllale prima di creare un nuovo candidato.
            </p>
            <ul className="space-y-2">
              {duplicates.map(({ candidate, reasons }) => (
                <li key={candidate.id}>
                  <Link target="_blank" href={candidateHref(candidate.id)} className="font-medium underline">
                    {candidate.firstName} {candidate.lastName}
                  </Link>{" "}
                  — {reasons.join(", ")}
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(event) => setAllowDuplicate(event.target.checked)}
              />
              Ho verificato: è una persona diversa. Crea comunque una nuova scheda.
            </label>
          </div>
        )}
      </FormDialog>
    </>
  );
}
