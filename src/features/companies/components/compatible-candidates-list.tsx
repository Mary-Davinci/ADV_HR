"use client";

import { Check, Download, ExternalLink, FileX, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";

import { FilterSelect } from "@/components/common/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EDUCATION_LEVEL_LABELS } from "@/config/labels";
import { candidateHref } from "@/features/candidates/lib/routes";
import { createApplicationsAction } from "@/features/recruiting/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { cn } from "@/lib/utils";
import type { PositionMatch, PositionMatchSource } from "@/repositories/types";

/** Gruppi della lista, nello stesso ordine usato dal server per ordinare i candidati. */
const GROUPS: Array<{ source: PositionMatchSource; title: string; hint: string }> = [
  { source: "EXPERIENCE", title: "Hanno già svolto il mestiere", hint: "dalle esperienze dichiarate" },
  { source: "CV", title: "Citano il mestiere nel CV", hint: "da verificare leggendo il CV" },
  { source: "INTEREST", title: "Interessati al mestiere", hint: "lo indicano come settore di interesse" },
  { source: "DETAILS", title: "Mestiere presente in formazione o note", hint: "corsi, certificazioni, note" },
];

type FilterKey = "near" | "experienced" | "readableCv" | "license" | "policy" | "noPolicy" | "orientation";

const FILTERS: Array<{ key: FilterKey; label: string; test: (item: PositionMatch) => boolean }> = [
  { key: "near", label: "Vicini alla sede", test: (item) => item.sameProvince || item.sameRegion },
  { key: "experienced", label: "Almeno 2 anni", test: (item) => (item.experienceYears ?? 0) >= 2 },
  { key: "readableCv", label: "CV leggibile", test: (item) => item.hasReadableCv },
  { key: "license", label: "Con patente", test: (item) => item.drivingLicense !== null },
  { key: "policy", label: "Con politica attiva", test: (item) => item.hasActivePolicy },
  { key: "noPolicy", label: "Senza politica attiva", test: (item) => !item.hasActivePolicy },
  { key: "orientation", label: "Orientamento completato", test: (item) => item.orientationCompleted },
];

/** "Con" e "senza" politica attiva si escludono: attivarne uno spegne l'altro. */
const EXCLUSIVE: Partial<Record<FilterKey, FilterKey>> = { policy: "noPolicy", noPolicy: "policy" };

const COLUMNS = 10;

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/** CV apribile in una nuova finestra (PDF e immagini) o scaricabile (altri formati). */
function CvLink({ item }: { item: PositionMatch }) {
  if (!item.cvDocumentId) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <FileX aria-hidden="true" className="size-3.5" />
        Nessuno
      </span>
    );
  }
  if (!item.cvViewable) {
    return (
      <a
        href={`/api/documents/${item.cvDocumentId}`}
        className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
        title="Formato Word: si scarica"
      >
        <Download aria-hidden="true" className="size-3.5" />
        Scarica
      </a>
    );
  }
  return (
    <a
      href={`/api/documents/${item.cvDocumentId}?view=1`}
      target="_blank"
      rel="noopener"
      className={cn(
        "inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline",
        item.hasReadableCv ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
      )}
      title={item.hasReadableCv ? "Apri il CV" : "CV scansionato: il sistema non ne legge il testo"}
    >
      <ExternalLink aria-hidden="true" className="size-3.5" />
      {item.hasReadableCv ? "Apri" : "Scansione"}
    </a>
  );
}

function CandidateRow({
  item,
  position,
  canAdd,
  checked,
  onToggle,
}: {
  item: PositionMatch;
  position: number;
  canAdd: boolean;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const name = `${item.firstName} ${item.lastName}`;
  const years = item.experienceYears;
  return (
    <TableRow className={cn("align-top", item.alreadyInSelection && "bg-muted/30")}>
      <TableCell className="w-8 pl-3">
        {canAdd && (
          <Checkbox
            aria-label={`Seleziona ${name}`}
            disabled={item.alreadyInSelection}
            checked={item.alreadyInSelection || checked}
            onCheckedChange={(value) => onToggle(Boolean(value))}
          />
        )}
      </TableCell>
      <TableCell className="w-8 text-right text-muted-foreground tabular-nums">{position}</TableCell>
      <TableCell className="max-w-56">
        <Link
          href={candidateHref(item.candidateId)}
          className="block truncate font-medium hover:underline"
          title={name}
        >
          {name}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {item.city ? `${item.city}${item.province ? ` (${item.province})` : ""}` : "Residenza non indicata"}
          {item.alreadyInSelection && " · già in selezione"}
        </span>
      </TableCell>
      <TableCell className="min-w-56 whitespace-normal">
        <span className="line-clamp-2 leading-snug" title={item.experienceSector ?? undefined}>
          {item.experienceSector ?? <Muted>Non indicata</Muted>}
        </span>
        {item.interestSector && item.interestSector !== item.experienceSector && (
          <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" title={item.interestSector}>
            Interesse: {item.interestSector}
          </span>
        )}
        {item.matchedRequirements.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {item.matchedRequirements.map((requirement) => (
              <Badge key={requirement} variant="secondary" className="gap-1 font-normal">
                <Check aria-hidden="true" className="size-3" />
                {requirement}
              </Badge>
            ))}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {years === null ? (
          <Muted>—</Muted>
        ) : (
          <span className="font-semibold">{years < 1 ? "< 1" : Math.floor(years)}</span>
        )}
      </TableCell>
      <TableCell>{item.educationLevel ? EDUCATION_LEVEL_LABELS[item.educationLevel] : <Muted>—</Muted>}</TableCell>
      <TableCell>{item.drivingLicense ?? <Muted>—</Muted>}</TableCell>
      <TableCell className="max-w-36 truncate" title={item.employmentStatus ?? undefined}>
        {item.employmentStatus ?? <Muted>—</Muted>}
      </TableCell>
      <TableCell>
        {item.sameProvince ? (
          <Badge variant="secondary" className="font-normal">
            Provincia
          </Badge>
        ) : item.sameRegion ? (
          <Badge variant="outline" className="font-normal">
            Regione
          </Badge>
        ) : (
          <Muted>—</Muted>
        )}
      </TableCell>
      <TableCell className="pr-3">
        <CvLink item={item} />
      </TableCell>
    </TableRow>
  );
}

export function CompatibleCandidatesList({
  selectionId,
  items,
  canAdd,
}: {
  selectionId: string;
  items: PositionMatch[];
  canAdd: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Set<FilterKey>>(new Set());
  const [region, setRegion] = useState<string | undefined>();

  // Regioni presenti nella lista, con il numero di candidati.
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) if (item.region) counts.set(item.region, (counts.get(item.region) ?? 0) + 1);
    return [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: `${value} (${count})` }));
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (!region || item.region === region) &&
          FILTERS.every((filter) => !active.has(filter.key) || filter.test(item)),
      ),
    [items, active, region],
  );
  const addable = visible.filter((item) => !item.alreadyInSelection);
  const allSelected = addable.length > 0 && addable.every((item) => selected.has(item.candidateId));
  // Numerazione = posizione nell'ordine completo, anche con i filtri attivi.
  const position = useMemo(() => new Map(items.map((item, index) => [item.candidateId, index + 1])), [items]);

  const add = useActionMutation(createApplicationsAction, {
    successMessage: ({ added, skipped }) =>
      `${added} ${added === 1 ? "candidato aggiunto" : "candidati aggiunti"} alla selezione` +
      (skipped ? ` (${skipped} già presenti)` : ""),
    onSuccess: () => {
      setSelected(new Set());
      router.refresh();
    },
  });

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleFilter = (key: FilterKey) =>
    setActive((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        const opposite = EXCLUSIVE[key];
        if (opposite) next.delete(opposite);
      }
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtra i candidati">
          <span className="text-sm text-muted-foreground">Mostra solo:</span>
          {regions.length > 0 && (
            <FilterSelect
              label="Regione di residenza"
              value={region}
              options={regions}
              allLabel="Tutte le regioni"
              onChange={setRegion}
              className="h-8 sm:min-w-40"
            />
          )}
          {FILTERS.map((filter) => {
            const pressed = active.has(filter.key);
            return (
              <Button
                key={filter.key}
                type="button"
                size="sm"
                variant={pressed ? "default" : "outline"}
                aria-pressed={pressed}
                onClick={() => toggleFilter(filter.key)}
              >
                {pressed && <Check aria-hidden="true" />}
                {filter.label}
                <span className={cn("tabular-nums", pressed ? "opacity-80" : "text-muted-foreground")}>
                  {items.filter(filter.test).length}
                </span>
              </Button>
            );
          })}
          {(active.size > 0 || region) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setActive(new Set());
                setRegion(undefined);
              }}
            >
              Azzera
            </Button>
          )}
        </div>
        {canAdd && (
          <Button
            size="sm"
            disabled={selected.size === 0 || add.isPending}
            onClick={() => add.mutate({ selectionId, candidateIds: [...selected] })}
          >
            {add.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserPlus aria-hidden="true" />}
            Aggiungi alla selezione{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nessun candidato con questi filtri.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <caption className="sr-only">Candidati compatibili, raggruppati per affidabilità del riscontro</caption>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-8 pl-3">
                  {canAdd && addable.length > 0 && (
                    <Checkbox
                      aria-label={`Seleziona tutti i visibili (${addable.length})`}
                      checked={allSelected}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? new Set(addable.map((item) => item.candidateId)) : new Set())
                      }
                    />
                  )}
                </TableHead>
                <TableHead className="w-8 text-right">#</TableHead>
                <TableHead>Candidato</TableHead>
                <TableHead>Mansione</TableHead>
                <TableHead className="text-right" title="Anni di esperienza">
                  Anni esp.
                </TableHead>
                <TableHead>Titolo</TableHead>
                <TableHead>Patente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Vicinanza</TableHead>
                <TableHead className="pr-3">CV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GROUPS.map((group) => {
                const members = visible.filter((item) => item.roleFoundIn[0] === group.source);
                if (members.length === 0) return null;
                return (
                  <Fragment key={group.source}>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableCell colSpan={COLUMNS} className="py-2 pl-3">
                        <span className="font-medium">{group.title}</span>{" "}
                        <span className="text-muted-foreground tabular-nums">{members.length}</span>
                        <span className="text-xs text-muted-foreground"> · {group.hint}</span>
                      </TableCell>
                    </TableRow>
                    {members.map((item) => (
                      <CandidateRow
                        key={item.candidateId}
                        item={item}
                        position={position.get(item.candidateId) ?? 0}
                        canAdd={canAdd}
                        checked={selected.has(item.candidateId)}
                        onToggle={(checked) => toggle(item.candidateId, checked)}
                      />
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
