import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RecruitingStage, UserRef } from "@/domain";
import { ApplicationActions } from "@/features/recruiting/components/application-actions";
import { EvaluationBadge, StageBadge } from "@/features/recruiting/components/badges";
import { EMPTY_VALUE, formatDateTime, formatSlot, formatTimeAgo } from "@/lib/format";
import type { ApplicationView, InterviewView } from "@/repositories/types";

interface PipelineTableProps {
  applications: ApplicationView[];
  stages: RecruitingStage[];
  recruiters: UserRef[];
  interviews: InterviewView[];
  permissions: { manage: boolean; evaluate: boolean; feedback: boolean; interview: boolean };
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/**
 * Pipeline della selezione in forma tabellare (niente drag & drop):
 * ordinata per stage, con le informazioni richieste da HR e azioni in riga.
 */
export function PipelineTable({ applications, stages, recruiters, interviews, permissions }: PipelineTableProps) {
  const counts = stages.map((stage) => ({
    stage,
    count: applications.filter((view) => view.stage.id === stage.id).length,
  }));

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="Candidature per stato">
        {counts
          .filter(({ count }) => count > 0)
          .map(({ stage, count }) => (
            <li key={stage.id} className="flex items-center gap-1.5 text-sm">
              <StageBadge code={stage.code} label={stage.label} />
              <span className="font-medium tabular-nums">{count}</span>
            </li>
          ))}
      </ul>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <caption className="sr-only">Candidature della selezione</caption>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Candidato</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Valutazione</TableHead>
              <TableHead className="hidden lg:table-cell">Recruiter</TableHead>
              <TableHead className="hidden xl:table-cell">Ultimo contatto</TableHead>
              <TableHead className="hidden md:table-cell">Ultimo feedback</TableHead>
              <TableHead>Prossimo colloquio</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Azioni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((view) => (
              <TableRow key={view.application.id}>
                <TableCell className="py-3 pl-4">
                  <Link
                    href={`/recruiting/${view.candidate.id}?tab=applications`}
                    className="font-medium hover:underline"
                  >
                    {view.candidate.fullName}
                  </Link>
                  <p
                    className="max-w-72 truncate text-xs text-muted-foreground"
                    title={view.candidate.occupation ?? undefined}
                  >
                    {[
                      view.candidate.occupation ?? "Mansione non indicata",
                      view.candidate.experienceYears !== null &&
                        (view.candidate.experienceYears < 1
                          ? "meno di 1 anno"
                          : `${Math.floor(view.candidate.experienceYears)} ${Math.floor(view.candidate.experienceYears) === 1 ? "anno" : "anni"}`),
                      view.candidate.city,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </TableCell>
                <TableCell>
                  <StageBadge code={view.stage.code} label={view.stage.label} />
                </TableCell>
                <TableCell>
                  <EvaluationBadge result={view.latestEvaluation?.result ?? null} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {view.recruiter?.displayName ?? <Muted>Non assegnato</Muted>}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  {view.lastContactAt ? formatTimeAgo(view.lastContactAt) : "Nessuno"}
                </TableCell>
                <TableCell className="hidden max-w-64 md:table-cell">
                  {view.latestFeedback ? (
                    <div title={view.latestFeedback.content}>
                      <p className="line-clamp-2 text-sm">{view.latestFeedback.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {view.latestFeedback.author}, {formatDateTime(view.latestFeedback.createdAt)}
                      </p>
                    </div>
                  ) : (
                    <Muted>{EMPTY_VALUE}</Muted>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  {view.nextInterviewAt ? formatSlot(view.nextInterviewAt) : <Muted>{EMPTY_VALUE}</Muted>}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <ApplicationActions
                      compact
                      applicationId={view.application.id}
                      candidateName={view.candidate.fullName}
                      related={view.related}
                      stageId={view.stage.id}
                      stages={stages}
                      interviews={interviews
                        .filter((item) => item.interview.applicationId === view.application.id)
                        .map((item) => item.interview)}
                      recruiters={recruiters}
                      recruiterId={view.application.recruiterId}
                      permissions={permissions}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
