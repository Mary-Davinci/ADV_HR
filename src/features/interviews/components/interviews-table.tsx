import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INTERVIEW_TYPE_LABELS } from "@/config/labels";
import { EvaluationBadge, InterviewStatusBadge } from "@/features/recruiting/components/badges";
import { formatInterviewDay, formatTime } from "@/lib/format";
import type { InterviewHistoryView, InterviewView } from "@/repositories/types";

const candidateHref = (view: InterviewHistoryView) => `/recruiting/${view.candidate.id}?tab=applications`;

/** Colloquio passato ma ancora "programmato": va registrato l'esito (svolto, annullato o non presentato). */
function ToClose() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      Esito da registrare
    </span>
  );
}

function Status({ view, now }: { view: InterviewHistoryView; now: Date }) {
  if (view.outcome) return <EvaluationBadge result={view.outcome} />;
  if (view.status === "SCHEDULED" && view.occurredAt <= now) return <ToClose />;
  return view.status ? <InterviewStatusBadge status={view.status} /> : <EvaluationBadge result={null} />;
}

/**
 * Registro dei colloqui: ogni riga apre la scheda del candidato sulle candidature.
 * Negli svolti compaiono esito e prima riga del resoconto.
 */
export function InterviewsTable({
  items,
  done,
  now,
}: {
  items: Array<InterviewView | InterviewHistoryView>;
  done: boolean;
  now: Date;
}) {
  const rows: InterviewHistoryView[] = items.map((item) =>
    "interview" in item
      ? {
          id: item.interview.id,
          source: "INTERVIEW",
          occurredAt: item.interview.scheduledAt,
          type: item.interview.type,
          status: item.interview.status,
          notes: item.interview.notes,
          outcome: item.outcome ?? null,
          candidate: item.candidate,
          selection: item.selection,
          company: item.company,
          recruiter: item.recruiter,
        }
      : item,
  );
  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label="Colloqui">
        {rows.map((view) => (
          <li
            key={`${view.source}:${view.id}`}
            className="relative space-y-1.5 rounded-xl border bg-card p-4 focus-within:ring-2 focus-within:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <Link href={candidateHref(view)} className="font-medium outline-none after:absolute after:inset-0">
                {view.candidate.fullName}
              </Link>
              <Status view={view} now={now} />
            </div>
            <p className="text-sm font-medium first-letter:uppercase">
              {formatInterviewDay(view.occurredAt)} · ore {formatTime(view.occurredAt)}
            </p>
            <p className="text-sm text-muted-foreground">
              {view.selection.title} · {view.company.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {view.type ? INTERVIEW_TYPE_LABELS[view.type] : "Valutazione"}
              {view.recruiter && ` · ${view.recruiter.displayName}`}
            </p>
            {done && view.notes && <p className="line-clamp-2 text-xs text-muted-foreground">{view.notes}</p>}
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
              <TableHead className="hidden lg:table-cell">Recruiter</TableHead>
              <TableHead>{done ? "Esito" : "Stato"}</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((view) => (
              <TableRow key={`${view.source}:${view.id}`} className="group relative focus-within:bg-muted/50">
                <TableCell className="py-3 pl-4 align-top">
                  <span className="block font-medium first-letter:uppercase">
                    {formatInterviewDay(view.occurredAt)}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">ore {formatTime(view.occurredAt)}</span>
                  {view.source === "EVALUATION" && (
                    <span className="block text-xs text-muted-foreground">Esito registrato</span>
                  )}
                </TableCell>
                <TableCell className="max-w-64 align-top whitespace-normal">
                  <Link
                    href={candidateHref(view)}
                    className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {view.candidate.fullName}
                  </Link>
                  {done && view.notes && (
                    <p className="line-clamp-1 text-xs text-muted-foreground" title={view.notes}>
                      {view.notes}
                    </p>
                  )}
                </TableCell>
                <TableCell className="max-w-72 align-top whitespace-normal">
                  <span className="block truncate">{view.selection.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{view.company.name}</span>
                </TableCell>
                <TableCell className="hidden align-top lg:table-cell">
                  {view.type ? INTERVIEW_TYPE_LABELS[view.type] : "Valutazione"}
                </TableCell>
                <TableCell className="hidden align-top lg:table-cell">
                  {view.recruiter?.displayName ?? <span className="text-muted-foreground">Non indicato</span>}
                </TableCell>
                <TableCell className="align-top">
                  <Status view={view} now={now} />
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
