"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { optionsOf, TASK_PRIORITY_LABELS } from "@/config/labels";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";

import { taskSchema } from "../schemas";
import { createTaskAction } from "../server/actions";

type TaskInput = z.input<typeof taskSchema>;

export function CreateTaskButton({
  users,
  defaultAssigneeId,
  selections,
}: {
  users: Array<{ id: string; displayName: string }>;
  defaultAssigneeId: string;
  selections: Array<{ id: string; title: string; companyName: string }>;
}) {
  const [open, setOpen] = useState(false);
  const defaults: TaskInput = {
    title: "",
    description: "",
    assignedTo: defaultAssigneeId,
    priority: "MEDIUM",
    dueAt: "",
    candidateId: "",
    applicationId: "",
    selectionId: "",
  };
  const form = useForm<TaskInput>({ resolver: actionResolver(taskSchema), defaultValues: defaults });
  const mutation = useActionMutation(createTaskAction, {
    successMessage: "Task creato",
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Button
        onClick={() => {
          form.reset(defaults);
          setOpen(true);
        }}
      >
        <Plus aria-hidden="true" />
        Nuovo task
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Nuovo task"
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        submitLabel="Crea task"
      >
        <TextField<TaskInput> name="title" label="Titolo" required maxLength={200} />
        <TextareaField<TaskInput> name="description" label="Descrizione" rows={3} maxLength={2000} />
        <FieldRow>
          <SelectField<TaskInput>
            name="assignedTo"
            label="Assegnato a"
            required
            options={users.map((user) => ({ value: user.id, label: user.displayName }))}
          />
          <SelectField<TaskInput> name="priority" label="Priorità" required options={optionsOf(TASK_PRIORITY_LABELS)} />
        </FieldRow>
        <FieldRow>
          <TextField<TaskInput> name="dueAt" label="Scadenza" type="date" />
          <SelectField<TaskInput>
            name="selectionId"
            label="Selezione collegata"
            emptyLabel="Nessuna"
            options={selections.map((selection) => ({
              value: selection.id,
              label: `${selection.title} — ${selection.companyName}`,
            }))}
          />
        </FieldRow>
      </FormDialog>
    </>
  );
}
