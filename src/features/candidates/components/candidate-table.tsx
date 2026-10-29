import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AVAILABILITY_LABELS, labelOf } from "@/config/labels";
import { StageBadge } from "@/features/recruiting/components/badges";
import { EMPTY_VALUE, formatDateTime, formatSlot, formatTimeAgo } from "@/lib/format";
import type { CandidateListItem } from "@/repositories/types";

import { candidateHref } from "../lib/routes";
import { OriginBadge } from "./origin-badge";

function Stage({ item }: { item: CandidateListItem }) {
  const application = item.latestApplication;
  if (!application) return <span className="text-sm text-muted-foreground">Nessuna candidatura</span>;
  return (
    <div className="space-y-1">
      <StageBadge code={application.stageCode} label={application.stageLabel} />
      <p className="max-w-56 truncate text-xs text-muted-foreground" title={application.selectionTitle}>
        {application.selectionTitle}
      </p>
    </div>
  );
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
            {item.latestApplication?.recruiter?.displayName ?? "Nessun recruiter"}
            {item.city && ` · ${item.city}`}
          </p>
        </div>
        {item.latestApplication && (
          <StageBadge code={item.latestApplication.stageCode} label={item.latestApplication.stageLabel} />
        )}
      </div>
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

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <caption className="sr-only">Elenco candidati: seleziona un nome per aprire la scheda</caption>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Candidato</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Prossimo colloquio</TableHead>
              <TableHead className="hidden lg:table-cell">Recruiter</TableHead>
              <TableHead>Disponibilità</TableHead>
              <TableHead className="hidden xl:table-cell">Ultimo contatto</TableHead>
              <TableHead className="hidden xl:table-cell">Ultima modifica</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="group relative focus-within:bg-muted/50">
                <TableCell className="py-3 pl-4">
                  <div className="flex items-center gap-3">
                    <OriginBadge origin={item.origin} />
                    <div className="min-w-0">
                      <Link
                        href={candidateHref(item.id)}
                        className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                      >
                        {item.firstName} {item.lastName}
                      </Link>
                      {item.city && (
                        <p className="text-xs text-muted-foreground">
                          {item.city}
                          {item.province && ` (${item.province})`}
                        </p>
                      )}
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
                  {item.latestApplication?.recruiter?.displayName ?? <Muted>Non assegnato</Muted>}
                </TableCell>
                <TableCell>{labelOf(AVAILABILITY_LABELS, item.availability, "Non indicata")}</TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  {item.lastContactAt ? (
                    <time dateTime={item.lastContactAt.toISOString()} title={formatDateTime(item.lastContactAt)}>
                      {formatTimeAgo(item.lastContactAt)}
                    </time>
                  ) : (
                    "Nessuno"
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
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
