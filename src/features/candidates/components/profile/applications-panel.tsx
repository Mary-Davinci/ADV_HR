import { Briefcase } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EVALUATION_RESULT_LABELS, FEEDBACK_TYPE_LABELS, INTERVIEW_TYPE_LABELS } from "@/config/labels";
import type { RecruitingStage, UserRef } from "@/domain";
import { ApplicationActions } from "@/features/recruiting/components/application-actions";
import { EvaluationBadge, InterviewStatusBadge, StageBadge } from "@/features/recruiting/components/badges";
import { formatDateTime, formatSlot, formatTimeAgo } from "@/lib/format";
import type { CandidateProfileView } from "@/services/candidate-service";

export interface PanelPermissions {
  manage: boolean;
  evaluate: boolean;
  feedback: boolean;
  interview: boolean;
}

export function ApplicationsPanel({
  profile,
  stages,
  recruiters,
  permissions,
}: {
  profile: CandidateProfileView;
  stages: RecruitingStage[];
  recruiters: UserRef[];
  permissions: PanelPermissions;
}) {
  if (profile.applications.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Nessuna candidatura"
        description="Il candidato non è ancora associato a una selezione. Usa “Associa a selezione” in alto."
      />
    );
  }

  return (
    <div className="space-y-4">
      {profile.applications.map((view) => {
        const evaluations = profile.evaluations[view.application.id] ?? [];
        const feedbacks = profile.feedbacks.filter((feedback) => feedback.applicationId === view.application.id);
        const interviews = profile.interviews.filter((item) => item.interview.applicationId === view.application.id);
        const headingId = `application-${view.application.id}`;
        return (
          <Card key={view.application.id} role="region" aria-labelledby={headingId}>
            <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <h3 id={headingId} className="text-base font-medium">
                  <Link
                    href={`/companies/${view.company.id}/selections/${view.selection.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {view.selection.title}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">
                  <Link href={`/companies/${view.company.id}`} className="underline-offset-4 hover:underline">
                    {view.company.name}
                  </Link>{" "}
                  · candidatura del {formatDateTime(view.application.createdAt)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <StageBadge code={view.stage.code} label={view.stage.label} />
                  <EvaluationBadge result={view.latestEvaluation?.result ?? null} />
                </div>
              </div>
              <ApplicationActions
                applicationId={view.application.id}
                candidateName={profile.fullName}
                stageId={view.stage.id}
                stages={stages}
                interviews={interviews.map((item) => item.interview)}
                recruiters={recruiters}
                recruiterId={view.application.recruiterId}
                permissions={permissions}
              />
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <dl className="grid content-start gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Recruiter</dt>
                  <dd>{view.recruiter?.displayName ?? "Non assegnato"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Prossimo colloquio</dt>
                  <dd>{formatSlot(view.nextInterviewAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Ultimo contatto</dt>
                  <dd>{view.lastContactAt ? formatTimeAgo(view.lastContactAt) : "Nessuno"}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Storico valutazioni
                </h4>
                {evaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessuna valutazione.</p>
                ) : (
                  <ol className="space-y-2">
                    {evaluations.map((evaluation) => (
                      <li key={evaluation.id} className="text-sm">
                        <p className="font-medium">{EVALUATION_RESULT_LABELS[evaluation.result]}</p>
                        {evaluation.reason && <p className="text-muted-foreground">Motivo: {evaluation.reason}</p>}
                        {evaluation.notes && <p className="text-muted-foreground">{evaluation.notes}</p>}
                        <p className="text-xs text-muted-foreground">
                          {evaluation.evaluatedBy.displayName}, {formatDateTime(evaluation.evaluatedAt)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Feedback</h4>
                {feedbacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun feedback.</p>
                ) : (
                  <ol className="space-y-3">
                    {feedbacks.map((feedback) => (
                      <li key={feedback.id} className="text-sm">
                        <p className="leading-relaxed whitespace-pre-line">{feedback.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {FEEDBACK_TYPE_LABELS[feedback.type]} · {feedback.author.displayName},{" "}
                          {formatDateTime(feedback.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {interviews.length > 0 && (
                <div className="space-y-2 md:col-span-3">
                  <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Colloqui</h4>
                  <ul className="flex flex-wrap gap-2">
                    {interviews.map((item) => (
                      <li
                        key={item.interview.id}
                        className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
                      >
                        <span>
                          {INTERVIEW_TYPE_LABELS[item.interview.type]} · {formatDateTime(item.interview.scheduledAt)}
                        </span>
                        <InterviewStatusBadge status={item.interview.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
