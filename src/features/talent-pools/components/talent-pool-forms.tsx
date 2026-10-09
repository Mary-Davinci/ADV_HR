"use client";

import { Plus, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmButton } from "@/components/common/confirm-button";
import { TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CandidatePicker } from "@/features/recruiting/components/add-application-buttons";
import { talentPoolSchema } from "@/features/tasks/schemas";
import { addPoolMemberAction, createTalentPoolAction, removePoolMemberAction } from "@/features/tasks/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type PoolInput = z.input<typeof talentPoolSchema>;

export function CreateTalentPoolButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<PoolInput>({
    resolver: actionResolver(talentPoolSchema),
    defaultValues: { name: "", description: "" },
  });
  const mutation = useActionMutation(createTalentPoolAction, {
    successMessage: "Talent pool creato",
    onSuccess: ({ id }) => {
      setOpen(false);
      router.push(`/talent-pools/${id}`);
    },
  });
  return (
    <>
      <Button
        onClick={() => {
          form.reset({ name: "", description: "" });
          setOpen(true);
        }}
      >
        <Plus aria-hidden="true" />
        Nuovo talent pool
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Nuovo talent pool"
        description="Raccogli profili interessanti per selezioni future."
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        submitLabel="Crea"
      >
        <TextField<PoolInput> name="name" label="Nome" required maxLength={120} />
        <TextareaField<PoolInput> name="description" label="Descrizione" rows={3} maxLength={1000} />
      </FormDialog>
    </>
  );
}

export function AddPoolMemberButton({ poolId, memberIds }: { poolId: string; memberIds: string[] }) {
  const [open, setOpen] = useState(false);
  const mutation = useActionMutation(addPoolMemberAction, {
    successMessage: (added: boolean) => (added ? "Candidato aggiunto" : "Il candidato era già presente"),
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden="true" />
        Aggiungi candidato
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aggiungi al talent pool</DialogTitle>
            <DialogDescription>Cerca e seleziona un candidato: viene aggiunto subito.</DialogDescription>
          </DialogHeader>
          <CandidatePicker
            selectedId=""
            excludeIds={memberIds}
            onSelect={(candidate) => mutation.mutate({ poolId, candidateId: candidate.id })}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemovePoolMemberButton({
  poolId,
  candidateId,
  name,
}: {
  poolId: string;
  candidateId: string;
  name: string;
}) {
  const mutation = useActionMutation(removePoolMemberAction, { successMessage: "Candidato rimosso dal talent pool" });
  return (
    <ConfirmButton
      size="sm"
      title={`Rimuovere ${name}?`}
      description="Il candidato esce dal talent pool; il suo profilo non viene modificato."
      confirmLabel="Rimuovi"
      onConfirm={() => mutation.mutateAsync({ poolId, candidateId })}
      aria-label={`Rimuovi ${name} dal talent pool`}
    >
      <UserMinus aria-hidden="true" />
      Rimuovi
    </ConfirmButton>
  );
}
