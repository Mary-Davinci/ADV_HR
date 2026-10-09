"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";

import { ConfirmButton } from "@/components/common/confirm-button";
import { CheckboxField, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { cn } from "@/lib/utils";
import type { CandidateCollectionKind, CandidateCollections } from "@/repositories/types";

import { COLLECTION_SCHEMAS } from "../schemas/profile-schemas";
import { removeCollectionItemAction, saveCollectionItemAction } from "../server/actions";
import { COLLECTION_CONFIG, type FieldDescriptor } from "./collection-config";

function DescriptorField({ field }: { field: FieldDescriptor }) {
  const className = cn(field.wide && "sm:col-span-2");
  switch (field.type) {
    case "select":
      return (
        <SelectField
          name={field.name}
          label={field.label}
          options={field.options}
          required={field.required}
          className={className}
        />
      );
    case "checkbox":
      return (
        <CheckboxField name={field.name} label={field.label} description={field.description} className={className} />
      );
    case "textarea":
      return (
        <TextareaField
          name={field.name}
          label={field.label}
          maxLength={field.maxLength}
          className={className}
          rows={3}
        />
      );
    default:
      return (
        <TextField
          name={field.name}
          label={field.label}
          type={field.type}
          required={field.required}
          description={field.description}
          maxLength={field.maxLength}
          className={className}
        />
      );
  }
}

interface CollectionEditorProps<K extends CandidateCollectionKind> {
  candidateId: string;
  kind: K;
  items: Array<CandidateCollections[K]>;
  canEdit: boolean;
}

/**
 * Sezione del profilo con elenco + aggiunta/modifica/eliminazione per singolo
 * elemento. Validazione client (UX) e server (sicurezza) con lo stesso schema Zod.
 */
export function CollectionEditor<K extends CandidateCollectionKind>({
  candidateId,
  kind,
  items,
  canEdit,
}: CollectionEditorProps<K>) {
  const config = COLLECTION_CONFIG[kind];
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);

  const form = useForm<FieldValues>({
    resolver: actionResolver(COLLECTION_SCHEMAS[kind]) as never,
    defaultValues: config.defaults,
  });

  const save = useActionMutation(saveCollectionItemAction, {
    successMessage: editing?.id ? "Modifica salvata" : `${capitalize(config.itemLabel)} aggiunta`,
    onSuccess: () => setEditing(null),
  });
  const remove = useActionMutation(removeCollectionItemAction, { successMessage: "Elemento eliminato" });

  function openEditor(item: CandidateCollections[K] | null) {
    form.reset(item ? config.toForm(item) : config.defaults);
    setEditing({ id: item ? (item as { id: string }).id : null });
  }

  const headingId = `collection-${kind}`;

  return (
    <Card role="region" aria-labelledby={headingId}>
      <CardHeader>
        <h3 id={headingId} className="text-base leading-snug font-medium">
          {config.title}
        </h3>
        {canEdit && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => openEditor(null)}>
              <Plus aria-hidden="true" />
              Aggiungi
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{config.emptyText}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const summary = config.summary(item);
              const id = (item as { id: string }).id;
              return (
                <li key={id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">{summary.title}</p>
                    {summary.subtitle && <p className="text-sm text-muted-foreground">{summary.subtitle}</p>}
                    {summary.meta && <p className="text-xs text-muted-foreground">{summary.meta}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Modifica ${config.itemLabel}: ${summary.title}`}
                        onClick={() => openEditor(item)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <ConfirmButton
                        size="icon-sm"
                        aria-label={`Elimina ${config.itemLabel}: ${summary.title}`}
                        title={`Eliminare ${config.itemLabel}?`}
                        description={`"${summary.title}" verrà rimosso dal profilo. L'operazione resta tracciata nella timeline.`}
                        confirmLabel="Elimina"
                        onConfirm={() => remove.mutateAsync({ candidateId, kind, itemId: id })}
                      >
                        <Trash2 aria-hidden="true" />
                      </ConfirmButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={`${editing?.id ? "Modifica" : "Aggiungi"} ${config.itemLabel}`}
        form={form}
        onSubmit={(values) => save.mutate({ candidateId, kind, itemId: editing?.id ?? null, values })}
        isPending={save.isPending}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {config.fields.map((field) => (
            <DescriptorField key={field.name} field={field} />
          ))}
        </div>
      </FormDialog>
    </Card>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
