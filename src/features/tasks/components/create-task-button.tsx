"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { optionsOf, TASK_PRIORITY_LABELS } from "@/config/labels";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import type { TaskView } from "@/repositories/types";
import { format } from "date-fns";

import { taskSchema } from "../schemas";
import { createTaskAction, updateTaskAction } from "../server/actions";

type TaskInput = z.input<typeof taskSchema>;

export function CreateTaskButton({
  users,
  defaultAssigneeId,
  selections,
  task,
}: {
  users: Array<{ id: string; displayName: string }>;
  defaultAssigneeId: string;
  selections: Array<{ id: string; title: string; companyName: string }>;
  task?: TaskView;
}) {
  const [open, setOpen] = useState(false);
  const defaults: TaskInput = {
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignedTo: task?.assignedTo.id ?? defaultAssigneeId,
    priority: task?.priority ?? "MEDIUM",
    dueAt: task?.dueAt ? format(task.dueAt, "yyyy-MM-dd") : "",
    candidateId: task?.candidateId ?? "",
    applicationId: task?.applicationId ?? "",
    selectionId: task?.selectionId ?? "",
  };
  const form = useForm<TaskInput>({ resolver: actionResolver(taskSchema), defaultValues: defaults });
  const mutation = useActionMutation(
    (values: TaskInput) => (task ? updateTaskAction({ taskId: task.id, values }) : createTaskAction(values)),
    {
      successMessage: task ? "Task aggiornato" : "Task creato",
      onSuccess: () => setOpen(false),
    },
  );

  return (
    <>
      <Button
        variant={task ? "ghost" : "default"}
        size={task ? "icon-sm" : "default"}
        aria-label={task ? `Modifica task: ${task.title}` : undefined}
        onClick={() => {
          form.reset(defaults);
          setOpen(true);
        }}
      >
        {task ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {!task && "Nuovo task"}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={task ? "Modifica task" : "Nuovo task"}
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        submitLabel={task ? "Salva modifiche" : "Crea task"}
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
