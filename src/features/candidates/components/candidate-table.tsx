import { Check, ChevronRight, X } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AVAILABILITY_LABELS, EVALUATION_RESULT_LABELS, labelOf } from "@/config/labels";
import type { EvaluationResult } from "@/domain";
import { StageBadge } from "@/features/recruiting/components/badges";
import { EMPTY_VALUE, formatDateTime, formatSlot, formatTimeAgo } from "@/lib/format";
import type { CandidateListItem } from "@/repositories/types";

import { candidateHref } from "../lib/routes";
import { OriginBadge } from "./origin-badge";

function EvaluationIndicator({ result }: { result: EvaluationResult | null }) {
  if (result !== "SUITABLE" && result !== "NOT_SUITABLE") return null;
  const Icon = result === "SUITABLE" ? Check : X;
  const label = `Esito candidatura: ${EVALUATION_RESULT_LABELS[result]}`;

  return (
    <span role="img" aria-label={label} title={label} className="shrink-0">
      <Icon
        aria-hidden="true"
        strokeWidth={3}
        className={
          result === "SUITABLE"
            ? "size-4 text-emerald-600 dark:text-emerald-400"
            : "size-4 text-red-600 dark:text-red-400"
        }
      />
    </span>
  );
}

function Stage({ item }: { item: CandidateListItem }) {
  const application = item.latestApplication;
  if (!application) return <span className="text-sm text-muted-foreground">Nessuna candidatura</span>;
  return (
    <div className="space-y-1">
      <StageBadge code={application.stageCode} label={application.stageLabel} />
      <div className="flex items-center gap-1.5">
        <p className="max-w-full truncate text-xs text-muted-foreground" title={application.selectionTitle}>
          {application.selectionTitle}
        </p>
        <EvaluationIndicator result={application.latestEvaluationResult} />
      </div>
    </div>
  );
}

/** "20121 Milano (MI)": CAP, comune e provincia, ciascuno solo se presente. */
function residenceOf({ postalCode, city, province }: CandidateListItem) {
  return [postalCode, city, province && `(${province})`].filter(Boolean).join(" ");
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function CandidateCard({ item }: { item: CandidateListItem }) {
  return (
    <li className="relative rounded-xl border bg-card p-4 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <OriginBadge origin={item.origin} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <Link
            href={candidateHref(item.id)}
            className="font-medium outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {item.firstName} {item.lastName}
          </Link>
          <p className="truncate text-sm text-muted-foreground">
            {item.recruiter?.displayName ?? "Nessun recruiter"}
            {residenceOf(item) && ` · ${residenceOf(item)}`}
          </p>
        </div>
      </div>
      {item.latestApplication && (
        <div className="mt-3">
          <Stage item={item} />
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Prossimo colloquio</dt>
          <dd>{formatSlot(item.nextInterviewAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Disponibilità</dt>
          <dd>{labelOf(AVAILABILITY_LABELS, item.availability)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Ultima modifica</dt>
          <dd className="text-xs text-muted-foreground">Aggiornato {formatTimeAgo(item.updatedAt)}</dd>
        </div>
      </dl>
    </li>
  );
}

/** Lista candidati: solo le informazioni utili a colpo d'occhio, niente tabella da 20 colonne. */
export function CandidateTable({ items }: { items: CandidateListItem[] }) {
  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label="Candidati">
        {items.map((item) => (
          <CandidateCard key={item.id} item={item} />
        ))}
      </ul>

      <div className="hidden max-w-full min-w-0 overflow-hidden rounded-xl border bg-card md:block">
        <Table className="min-w-[42rem] table-fixed">
          <caption className="sr-only">Elenco candidati: seleziona un nome per aprire la scheda</caption>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[24%] pl-4">Candidato</TableHead>
              <TableHead className="w-[23%]">Stato</TableHead>
              <TableHead>Prossimo colloquio</TableHead>
              <TableHead className="hidden lg:table-cell">Recruiter</TableHead>
              <TableHead>Disponibilità</TableHead>
              <TableHead className="hidden 2xl:table-cell">Ultimo contatto</TableHead>
              <TableHead className="hidden 2xl:table-cell">Ultima modifica</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="group relative focus-within:bg-muted/50">
                <TableCell className="py-3 pl-4 whitespace-normal">
                  <div className="flex items-center gap-3">
                    <OriginBadge origin={item.origin} />
                    <div className="min-w-0 break-words">
                      <Link
                        href={candidateHref(item.id)}
                        className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                      >
                        {item.firstName} {item.lastName}
                      </Link>
                      {residenceOf(item) && <p className="text-xs text-muted-foreground">{residenceOf(item)}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Stage item={item} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {item.nextInterviewAt ? formatSlot(item.nextInterviewAt) : <Muted>{EMPTY_VALUE}</Muted>}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {item.recruiter?.displayName ?? <Muted>Non assegnato</Muted>}
                </TableCell>
                <TableCell>{labelOf(AVAILABILITY_LABELS, item.availability, "Non indicata")}</TableCell>
                <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                  {item.lastContactAt ? (
                    <time dateTime={item.lastContactAt.toISOString()} title={formatDateTime(item.lastContactAt)}>
                      {formatTimeAgo(item.lastContactAt)}
                    </time>
                  ) : (
                    "Nessuno"
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                  <time dateTime={item.updatedAt.toISOString()} title={formatDateTime(item.updatedAt)}>
                    {formatTimeAgo(item.updatedAt)}
                  </time>
                </TableCell>
                <TableCell className="pr-4">
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
