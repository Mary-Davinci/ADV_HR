"use client";

import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { SelectField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APPLICATION_SOURCE_LABELS, optionsOf } from "@/config/labels";
import { lookupCandidatesAction } from "@/features/candidates/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { createApplicationSchema } from "../schemas";
import { createApplicationAction } from "../server/actions";

type ApplicationFormInput = z.input<typeof createApplicationSchema>;

const SOURCE_OPTIONS = optionsOf(APPLICATION_SOURCE_LABELS).filter(
  (option) => option.value !== "ADV_CORE" && option.value !== "ADV_HR",
);

interface Recruiter {
  id: string;
  displayName: string;
}

/** Dalla scheda candidato: associa il candidato a una selezione aziendale. */
export function AddToSelectionButton({
  candidateId,
  selections,
  recruiters,
  excludeSelectionIds,
}: {
  candidateId: string;
  selections: Array<{ id: string; title: string; companyName: string }>;
  recruiters: Recruiter[];
  excludeSelectionIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const available = selections.filter((selection) => !excludeSelectionIds.includes(selection.id));
  const defaults: ApplicationFormInput = {
    candidateId,
    selectionId: available[0]?.id ?? "",
    recruiterId: "",
    source: "MANUAL",
  };
  const form = useForm<ApplicationFormInput>({
    resolver: actionResolver(createApplicationSchema),
    defaultValues: defaults,
  });
  const mutation = useActionMutation(createApplicationAction, {
    successMessage: "Candidato associato alla selezione",
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
        disabled={available.length === 0}
        title={available.length === 0 ? "Nessuna selezione aperta disponibile" : undefined}
      >
        <Plus aria-hidden="true" />
        Associa a selezione
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Associa a una selezione"
        description="Crea una candidatura: stato iniziale “Nuovo”."
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        submitLabel="Associa"
      >
        <SelectField<ApplicationFormInput>
          name="selectionId"
          label="Selezione"
          required
          options={available.map((selection) => ({
            value: selection.id,
            label: `${selection.title} — ${selection.companyName}`,
          }))}
        />
        <SelectField<ApplicationFormInput>
          name="recruiterId"
          label="Recruiter"
          emptyLabel="Non assegnato"
          options={recruiters.map((recruiter) => ({ value: recruiter.id, label: recruiter.displayName }))}
        />
        <SelectField<ApplicationFormInput> name="source" label="Fonte" required options={SOURCE_OPTIONS} />
      </FormDialog>
    </>
  );
}

/** Ricerca candidati con debounce (server action, max 10 risultati). */
function useCandidateLookup(text: string) {
  const [results, setResults] = useState<Array<{ id: string; fullName: string; city: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      const result = await lookupCandidatesAction({ text: query });
      if (!cancelled) {
        setResults(result.ok ? result.data : []);
        setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [text]);

  return { results: text.trim().length < 2 ? [] : results, loading };
}

export function CandidatePicker({
  selectedId,
  onSelect,
  excludeIds = [],
}: {
  selectedId: string;
  onSelect: (candidate: { id: string; fullName: string }) => void;
  excludeIds?: string[];
}) {
  const [text, setText] = useState("");
  const { results, loading } = useCandidateLookup(text);
  const inputId = useId();
  const listId = useId();
  const visible = results.filter((candidate) => !excludeIds.includes(candidate.id));

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        Cerca candidato
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Nome, cognome o codice fiscale (min. 2 caratteri)"
          className="h-9 pl-8"
          aria-controls={listId}
          autoComplete="off"
        />
        {loading && (
          <Loader2
            aria-hidden="true"
            className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Risultati ricerca candidati"
        className="max-h-56 overflow-y-auto rounded-lg border empty:hidden"
      >
        {visible.map((candidate) => (
          <li key={candidate.id} role="option" aria-selected={candidate.id === selectedId}>
            <button
              type="button"
              onClick={() => onSelect(candidate)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted",
                candidate.id === selectedId && "bg-accent font-medium",
              )}
            >
              <span>{candidate.fullName}</span>
              {candidate.city && <span className="text-xs text-muted-foreground">{candidate.city}</span>}
            </button>
          </li>
        ))}
      </ul>
      {text.trim().length >= 2 && !loading && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun candidato trovato.</p>
      )}
    </div>
  );
}

/** Dalla selezione: aggiunge un candidato esistente alla pipeline. */
export function AddCandidateToSelectionButton({
  selectionId,
  recruiters,
  existingCandidateIds,
}: {
  selectionId: string;
  recruiters: Recruiter[];
  existingCandidateIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const defaults: ApplicationFormInput = { candidateId: "", selectionId, recruiterId: "", source: "MANUAL" };
  const form = useForm<ApplicationFormInput>({
    resolver: actionResolver(createApplicationSchema),
    defaultValues: defaults,
  });
  const candidateId = useWatch({ control: form.control, name: "candidateId" });
  const mutation = useActionMutation(createApplicationAction, {
    successMessage: "Candidato aggiunto alla selezione",
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Button
        onClick={() => {
          form.reset(defaults);
          setSelectedName(null);
          setOpen(true);
        }}
      >
        <Plus aria-hidden="true" />
        Aggiungi candidato
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Aggiungi candidato alla selezione"
        form={form}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        submitLabel="Aggiungi"
      >
        <CandidatePicker
          selectedId={candidateId}
          excludeIds={existingCandidateIds}
          onSelect={(candidate) => {
            form.setValue("candidateId", candidate.id, { shouldValidate: true });
            setSelectedName(candidate.fullName);
          }}
        />
        <p className="text-sm" aria-live="polite">
          {selectedName ? (
            <>
              Selezionato: <span className="font-medium">{selectedName}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Nessun candidato selezionato.</span>
          )}
        </p>
        {form.formState.errors.candidateId && (
          <p role="alert" className="text-sm text-destructive">
            Seleziona un candidato dall&apos;elenco.
          </p>
        )}
        <SelectField<ApplicationFormInput>
          name="recruiterId"
          label="Recruiter"
          emptyLabel="Non assegnato"
          options={recruiters.map((recruiter) => ({ value: recruiter.id, label: recruiter.displayName }))}
        />
        <SelectField<ApplicationFormInput> name="source" label="Fonte" required options={SOURCE_OPTIONS} />
      </FormDialog>
    </>
  );
}
