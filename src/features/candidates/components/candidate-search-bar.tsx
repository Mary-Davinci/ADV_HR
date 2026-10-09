"use client";

import { FilterX, Loader2, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { FilterSelect, type FilterOption } from "@/components/common/filter-select";
import { SearchInput } from "@/components/common/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DRIVING_LICENSE_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  optionsOf,
  WORK_MODE_LABELS,
  WORK_TIME_LABELS,
} from "@/config/labels";
import { CANDIDATE_SORT_OPTIONS } from "@/repositories/types";

import {
  countAdvancedFilters,
  DEFAULT_SORT,
  hasActiveFilters,
  INTERVIEW_WINDOWS,
  INTERVIEW_WINDOW_LABELS,
  PENDING_REVIEW_FILTER,
  SORT_LABELS,
  toSearchParams,
  type CandidateFilters,
} from "../schemas/candidate-filters";

const SEARCH_DEBOUNCE_MS = 350;
const YES_NO: FilterOption[] = [
  { value: "yes", label: "Sì" },
  { value: "no", label: "No" },
];

interface CandidateSearchBarProps {
  filters: CandidateFilters;
  stages: FilterOption[];
  recruiters: FilterOption[];
}

/**
 * Ricerca candidati. Lo stato vive nell'URL: filtri condivisibili,
 * persistenti al refresh, applicati server-side dal repository.
 */
export function CandidateSearchBar({ filters, stages, recruiters }: CandidateSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [search, setSearch] = useState(filters.q ?? "");
  const [syncedQuery, setSyncedQuery] = useState(filters.q);
  if (filters.q !== syncedQuery) {
    setSyncedQuery(filters.q);
    if ((filters.q ?? "") !== search.trim()) setSearch(filters.q ?? "");
  }

  function navigate(next: Partial<CandidateFilters>) {
    startTransition(() => router.replace(`${pathname}${toSearchParams(next)}`, { scroll: false }));
  }
  const update = (patch: Partial<CandidateFilters>) =>
    navigate({ ...filters, q: search.trim() || undefined, page: undefined, ...patch });

  useEffect(() => {
    const query = search.trim() || undefined;
    if (query === filters.q) return;
    const timeout = setTimeout(() => navigate({ ...filters, q: query, page: undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si reagisce solo al testo digitato
  }, [search]);

  const advancedCount = countAdvancedFilters(filters);

  return (
    <div className="flex flex-col gap-3" role="search" aria-label="Ricerca candidati">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          label="Cerca per nome, cognome, codice fiscale, email o città"
          placeholder="Nome, codice fiscale, email, città…"
          className="xl:max-w-sm xl:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            label="Filtra per stato"
            allLabel="Tutti gli stati"
            value={filters.stage}
            options={[{ value: PENDING_REVIEW_FILTER, label: "Da valutare (nuovi e da revisionare)" }, ...stages]}
            onChange={(stage) => update({ stage })}
          />
          <FilterSelect
            label="Filtra per recruiter"
            allLabel="Tutti i recruiter"
            value={filters.recruiter}
            options={recruiters}
            onChange={(recruiter) => update({ recruiter })}
          />
          <FilterSelect
            label="Filtra per colloquio"
            allLabel="Qualsiasi colloquio"
            value={filters.interview}
            options={INTERVIEW_WINDOWS.map((value) => ({ value, label: INTERVIEW_WINDOW_LABELS[value] }))}
            onChange={(interview) => update({ interview: interview as CandidateFilters["interview"] })}
          />
          <FilterSelect
            label="Ordina per"
            allLabel={`Ordina: ${SORT_LABELS[DEFAULT_SORT]}`}
            value={filters.sort === DEFAULT_SORT ? undefined : filters.sort}
            options={CANDIDATE_SORT_OPTIONS.filter((value) => value !== DEFAULT_SORT).map((value) => ({
              value,
              label: `Ordina: ${SORT_LABELS[value]}`,
            }))}
            onChange={(sort) => update({ sort: sort as CandidateFilters["sort"] })}
          />
          <Button variant="outline" className="h-9" onClick={() => setAdvancedOpen(true)}>
            <SlidersHorizontal aria-hidden="true" />
            Filtri avanzati
            {advancedCount > 0 && (
              <Badge className="ml-0.5 h-5 min-w-5 px-1.5" aria-label={`${advancedCount} filtri attivi`}>
                {advancedCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <div className="flex min-h-7 items-center gap-3 text-sm">
        {hasActiveFilters(filters) && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
            onClick={() => {
              setSearch("");
              navigate({ sort: filters.sort });
            }}
          >
            <FilterX aria-hidden="true" />
            Azzera filtri
          </Button>
        )}
        <span aria-live="polite" className="flex items-center gap-1.5 text-muted-foreground">
          {isPending && (
            <>
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              Aggiornamento risultati…
            </>
          )}
        </span>
      </div>

      <AdvancedFiltersSheet
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        filters={filters}
        onApply={(patch) => {
          update(patch);
          setAdvancedOpen(false);
        }}
      />
    </div>
  );
}

type AdvancedValues = Pick<
  CandidateFilters,
  | "city"
  | "region"
  | "skill"
  | "sector"
  | "language"
  | "employment"
  | "protected"
  | "relocate"
  | "workMode"
  | "workTime"
  | "license"
  | "minExp"
>;

const EMPTY_ADVANCED: AdvancedValues = {
  city: undefined,
  region: undefined,
  skill: undefined,
  sector: undefined,
  language: undefined,
  employment: undefined,
  protected: undefined,
  relocate: undefined,
  workMode: undefined,
  workTime: undefined,
  license: undefined,
  minExp: undefined,
};

function pickAdvanced(filters: CandidateFilters): AdvancedValues {
  return Object.fromEntries(
    Object.keys(EMPTY_ADVANCED).map((key) => [key, filters[key as keyof AdvancedValues]]),
  ) as AdvancedValues;
}

function TextFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value ?? ""}
        placeholder={placeholder}
        maxLength={80}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="h-9"
      />
    </div>
  );
}

function SelectFilter(props: {
  label: string;
  value: string | undefined;
  options: FilterOption[];
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{props.label}</Label>
      <FilterSelect id={id} {...props} allLabel="Qualsiasi" className="sm:w-full" />
    </div>
  );
}

function AdvancedFiltersSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CandidateFilters;
  onApply: (values: AdvancedValues) => void;
}) {
  const [values, setValues] = useState<AdvancedValues>(() => pickAdvanced(filters));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValues(pickAdvanced(filters));
  }
  const set = <K extends keyof AdvancedValues>(key: K, value: AdvancedValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Filtri avanzati</SheetTitle>
          <SheetDescription>Combina più criteri: vengono applicati insieme.</SheetDescription>
        </SheetHeader>
        <form
          id="advanced-filters"
          className="flex-1 space-y-5 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onApply(values);
          }}
        >
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Territorio
            </legend>
            <TextFilter label="Città" value={values.city} onChange={(v) => set("city", v)} placeholder="es. Bergamo" />
            <TextFilter
              label="Regione"
              value={values.region}
              onChange={(v) => set("region", v)}
              placeholder="es. Lombardia"
            />
            <SelectFilter
              label="Disponibile al trasferimento"
              value={values.relocate}
              options={YES_NO}
              onChange={(v) => set("relocate", v as AdvancedValues["relocate"])}
            />
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Profilo</legend>
            <TextFilter
              label="Competenza"
              value={values.skill}
              onChange={(v) => set("skill", v)}
              placeholder="es. Excel"
            />
            <TextFilter
              label="Settore"
              value={values.sector}
              onChange={(v) => set("sector", v)}
              placeholder="es. Logistica"
            />
            <TextFilter
              label="Lingua"
              value={values.language}
              onChange={(v) => set("language", v)}
              placeholder="es. Inglese"
            />
            <div className="grid gap-1.5">
              <Label htmlFor="min-exp">Esperienza minima (anni)</Label>
              <Input
                id="min-exp"
                type="number"
                min={1}
                max={40}
                value={values.minExp ?? ""}
                onChange={(event) => set("minExp", event.target.value ? Number(event.target.value) : undefined)}
                className="h-9"
              />
            </div>
            <SelectFilter
              label="Patente / abilitazione"
              value={values.license}
              options={optionsOf(DRIVING_LICENSE_LABELS)}
              onChange={(v) => set("license", v as AdvancedValues["license"])}
            />
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Situazione e preferenze
            </legend>
            <SelectFilter
              label="Stato occupazionale"
              value={values.employment}
              options={optionsOf(EMPLOYMENT_STATUS_LABELS)}
              onChange={(v) => set("employment", v as AdvancedValues["employment"])}
            />
            <SelectFilter
              label="Categoria protetta (L. 68/99)"
              value={values.protected}
              options={YES_NO}
              onChange={(v) => set("protected", v as AdvancedValues["protected"])}
            />
            <SelectFilter
              label="Modalità di lavoro"
              value={values.workMode}
              options={optionsOf(WORK_MODE_LABELS)}
              onChange={(v) => set("workMode", v as AdvancedValues["workMode"])}
            />
            <SelectFilter
              label="Orario (full / part time)"
              value={values.workTime}
              options={optionsOf(WORK_TIME_LABELS).filter((option) => option.value !== "EITHER")}
              onChange={(v) => set("workTime", v as AdvancedValues["workTime"])}
            />
          </fieldset>
        </form>
        <SheetFooter className="flex-row justify-between border-t">
          <Button type="button" variant="ghost" onClick={() => setValues(EMPTY_ADVANCED)}>
            Svuota
          </Button>
          <Button type="submit" form="advanced-filters">
            Applica filtri
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
