import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INTERVIEW_TYPE_LABELS } from "@/config/labels";
import { EvaluationBadge, InterviewStatusBadge } from "@/features/recruiting/components/badges";
import { formatInterviewDay, formatTime } from "@/lib/format";
import type { InterviewView } from "@/repositories/types";

const candidateHref = (view: InterviewView) => `/recruiting/${view.candidate.id}?tab=applications`;

/** Colloquio passato ma ancora "programmato": va chiuso (svolto, annullato o non presentato). */
function ToClose() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      Da chiudere
    </span>
  );
}

function Status({ view, done, now }: { view: InterviewView; done: boolean; now: Date }) {
  if (done && view.outcome) return <EvaluationBadge result={view.outcome} />;
  if (!done && view.interview.scheduledAt < now) return <ToClose />;
  return <InterviewStatusBadge status={view.interview.status} />;
}

/**
 * Registro dei colloqui: ogni riga apre la scheda del candidato sulle candidature.
 * Negli svolti compaiono esito e prima riga del resoconto.
 */
export function InterviewsTable({ items, done, now }: { items: InterviewView[]; done: boolean; now: Date }) {
  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label="Colloqui">
        {items.map((view) => (
          <li
            key={view.interview.id}
            className="relative space-y-1.5 rounded-xl border bg-card p-4 focus-within:ring-2 focus-within:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <Link href={candidateHref(view)} className="font-medium outline-none after:absolute after:inset-0">
                {view.candidate.fullName}
              </Link>
              <Status view={view} done={done} now={now} />
            </div>
            <p className="text-sm font-medium first-letter:uppercase">
              {formatInterviewDay(view.interview.scheduledAt)} · ore {formatTime(view.interview.scheduledAt)}
            </p>
            <p className="text-sm text-muted-foreground">
              {view.selection.title} · {view.company.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {INTERVIEW_TYPE_LABELS[view.interview.type]}
              {view.recruiter && ` · ${view.recruiter.displayName}`}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <caption className="sr-only">
            {done ? "Colloqui svolti" : "Colloqui da fare"}: seleziona una riga per aprire la scheda del candidato
          </caption>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Quando</TableHead>
              <TableHead>Candidato</TableHead>
              <TableHead>Selezione</TableHead>
              <TableHead className="hidden lg:table-cell">Tipo</TableHead>
              <TableHead className="hidden lg:table-cell">{done ? "Svolto da" : "Recruiter"}</TableHead>
              <TableHead>{done ? "Esito" : "Stato"}</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((view) => (
              <TableRow key={view.interview.id} className="group relative focus-within:bg-muted/50">
                <TableCell className="py-3 pl-4 align-top">
                  <span className="block font-medium first-letter:uppercase">
                    {formatInterviewDay(view.interview.scheduledAt)}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    ore {formatTime(view.interview.scheduledAt)}
                  </span>
                </TableCell>
                <TableCell className="max-w-64 align-top whitespace-normal">
                  <Link
                    href={candidateHref(view)}
                    className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {view.candidate.fullName}
                  </Link>
                  {done && view.interview.notes && (
                    <p className="line-clamp-1 text-xs text-muted-foreground" title={view.interview.notes}>
                      {view.interview.notes}
                    </p>
                  )}
                </TableCell>
                <TableCell className="max-w-72 align-top whitespace-normal">
                  <span className="block truncate">{view.selection.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{view.company.name}</span>
                </TableCell>
                <TableCell className="hidden align-top lg:table-cell">
                  {INTERVIEW_TYPE_LABELS[view.interview.type]}
                </TableCell>
                <TableCell className="hidden align-top lg:table-cell">
                  {view.recruiter?.displayName ?? <span className="text-muted-foreground">Non indicato</span>}
                </TableCell>
                <TableCell className="align-top">
                  <Status view={view} done={done} now={now} />
                </TableCell>
                <TableCell className="pr-4 align-top">
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
