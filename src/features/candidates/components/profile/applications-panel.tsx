import { Briefcase } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EVALUATION_RESULT_LABELS, FEEDBACK_TYPE_LABELS, INTERVIEW_TYPE_LABELS } from "@/config/labels";
import type { RecruitingStage, UserRef } from "@/domain";
import { ApplicationActions } from "@/features/recruiting/components/application-actions";
import {
  InterviewReportActions,
  RegisterCompletedInterviewButton,
} from "@/features/interviews/components/candidate-interview-actions";
import { InterviewEditButton } from "@/features/interviews/components/interview-edit-button";
import { InterviewDeleteButton } from "@/features/interviews/components/interview-delete-button";
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
        const allEvaluations = profile.evaluations[view.application.id] ?? [];
        const evaluations = allEvaluations.filter((evaluation) => !evaluation.interviewId);
        const feedbacks = profile.feedbacks.filter(
          (feedback) => feedback.applicationId === view.application.id && !feedback.interviewId,
        );
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
              <div className="flex flex-wrap gap-2">
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
                {permissions.interview && (
                  <RegisterCompletedInterviewButton
                    candidateId={profile.candidate.id}
                    candidateName={profile.fullName}
                    applications={[
                      { id: view.application.id, label: `${view.selection.title} · ${view.company.name}` },
                    ]}
                    recruiters={recruiters}
                    defaultRecruiterId={view.application.recruiterId}
                    canEvaluate={permissions.evaluate}
                  />
                )}
              </div>
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
                          Esito registrato da {evaluation.evaluatedBy.displayName} il{" "}
                          {formatDateTime(evaluation.evaluatedAt)}
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
                  <ul className="space-y-3">
                    {interviews.map((item) => {
                      const outcomes = allEvaluations.filter(
                        (evaluation) => evaluation.interviewId === item.interview.id,
                      );
                      const interviewFeedbacks = profile.feedbacks.filter(
                        (feedback) => feedback.interviewId === item.interview.id,
                      );
                      return (
                        <li key={item.interview.id} className="space-y-3 rounded-lg border p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{INTERVIEW_TYPE_LABELS[item.interview.type]}</p>
                            <InterviewStatusBadge status={item.interview.status} />
                          </div>
                          <dl className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                {item.interview.status === "COMPLETED" ? "Effettuato il" : "Previsto il"}
                              </dt>
                              <dd>
                                <time dateTime={item.interview.scheduledAt.toISOString()}>
                                  {formatDateTime(item.interview.scheduledAt)}
                                </time>
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">Registrato il</dt>
                              <dd>
                                <time dateTime={item.interview.createdAt.toISOString()}>
                                  {formatDateTime(item.interview.createdAt)}
                                </time>
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                {item.interview.status === "COMPLETED" ? "Svolto da" : "Recruiter"}
                              </dt>
                              <dd>{item.recruiter?.displayName ?? "Non indicato"}</dd>
                            </div>
                          </dl>
                          {item.interview.notes && (
                            <p className="whitespace-pre-wrap">
                              <span className="font-medium">Resoconto: </span>
                              {item.interview.notes}
                            </p>
                          )}
                          {outcomes.map((evaluation) => (
                            <div key={evaluation.id} className="space-y-1 border-t pt-3">
                              <EvaluationBadge result={evaluation.result} />
                              {evaluation.reason && (
                                <p className="whitespace-pre-wrap">Motivazione: {evaluation.reason}</p>
                              )}
                              {evaluation.notes && <p className="whitespace-pre-wrap">{evaluation.notes}</p>}
                              <p className="text-xs text-muted-foreground">
                                Esito registrato da {evaluation.evaluatedBy.displayName} il{" "}
                                {formatDateTime(evaluation.evaluatedAt)}
                              </p>
                            </div>
                          ))}
                          {interviewFeedbacks.map((feedback) => (
                            <div key={feedback.id} className="space-y-1 border-t pt-3">
                              <p className="whitespace-pre-wrap">{feedback.content}</p>
                              <p className="text-xs text-muted-foreground">
                                Feedback di {feedback.author.displayName} · {formatDateTime(feedback.createdAt)}
                              </p>
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-2">
                            {item.interview.status === "COMPLETED" && (
                              <InterviewReportActions
                                interview={item.interview}
                                candidateName={profile.fullName}
                                canEvaluate={permissions.evaluate}
                                canFeedback={permissions.feedback}
                              />
                            )}
                            {permissions.interview && (
                              <>
                                <InterviewEditButton
                                  interview={item.interview}
                                  candidateName={profile.fullName}
                                  recruiters={recruiters}
                                />
                                <InterviewDeleteButton
                                  interviewId={item.interview.id}
                                  candidateName={profile.fullName}
                                />
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
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
