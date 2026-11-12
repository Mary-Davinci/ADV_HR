import { Briefcase } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EVALUATION_RESULT_LABELS, FEEDBACK_TYPE_LABELS, INTERVIEW_TYPE_LABELS } from "@/config/labels";
import type { RecruitingStage, UserRef } from "@/domain";
import {
  InterviewReportActions,
  RegisterCompletedInterviewButton,
} from "@/features/interviews/components/candidate-interview-actions";
import { InterviewDeleteButton } from "@/features/interviews/components/interview-delete-button";
import { InterviewEditButton } from "@/features/interviews/components/interview-edit-button";
import { ApplicationActions } from "@/features/recruiting/components/application-actions";
import { EvaluationBadge, InterviewStatusBadge, StageBadge } from "@/features/recruiting/components/badges";
import { formatDate, formatDateTime, formatSlot } from "@/lib/format";
import type { CandidateProfileView } from "@/services/candidate-service";

export interface PanelPermissions {
  manage: boolean;
  evaluate: boolean;
  feedback: boolean;
  interview: boolean;
}

type ApplicationViewItem = CandidateProfileView["applications"][number];
type InterviewItem = CandidateProfileView["interviews"][number];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function ApplicationCard({
  view,
  profile,
  stages,
  recruiters,
  permissions,
  currentUserId,
}: {
  view: ApplicationViewItem;
  profile: CandidateProfileView;
  stages: RecruitingStage[];
  recruiters: UserRef[];
  permissions: PanelPermissions;
  currentUserId: string;
}) {
  const now = new Date();
  const evaluations = profile.evaluations[view.application.id] ?? [];
  const feedbacks = profile.feedbacks.filter((feedback) => feedback.applicationId === view.application.id);
  const interviews = profile.interviews.filter((item) => item.interview.applicationId === view.application.id);
  const upcoming = interviews
    .filter((item) => item.interview.status === "SCHEDULED" && item.interview.scheduledAt > now)
    .sort((a, b) => a.interview.scheduledAt.getTime() - b.interview.scheduledAt.getTime())[0];
  const closed =
    view.stage.isTerminal ||
    view.application.closedAt !== null ||
    ["CLOSED", "ARCHIVED"].includes(view.selection.status);
  const headingId = `application-${view.application.id}`;

  const history = [
    ...interviews.map((item) => ({
      at: item.interview.scheduledAt,
      key: item.interview.id,
      kind: "interview" as const,
      item,
    })),
    ...evaluations
      .filter((evaluation) => !evaluation.interviewId)
      .map((evaluation) => ({
        at: evaluation.evaluatedAt,
        key: evaluation.id,
        kind: "evaluation" as const,
        evaluation,
      })),
    ...feedbacks
      .filter((feedback) => !feedback.interviewId)
      .map((feedback) => ({ at: feedback.createdAt, key: feedback.id, kind: "feedback" as const, feedback })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const summary = [
    interviews.length > 0 && plural(interviews.length, "colloquio", "colloqui"),
    evaluations.length > 0 && plural(evaluations.length, "valutazione", "valutazioni"),
    feedbacks.length > 0 && plural(feedbacks.length, "feedback", "feedback"),
  ].filter(Boolean);

  return (
    <Card role="region" aria-labelledby={headingId}>
      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 id={headingId} className="text-lg leading-tight font-semibold">
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
            </Link>
            {` · dal ${formatDate(view.application.createdAt)}`}
            {view.recruiter && ` · recruiter ${view.recruiter.displayName}`}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StageBadge code={view.stage.code} label={view.stage.label} />
            {view.latestEvaluation && <EvaluationBadge result={view.latestEvaluation.result} />}
          </div>
        </div>
        <ApplicationActions
          compact
          closed={closed}
          applicationId={view.application.id}
          candidateName={profile.fullName}
          stageId={view.stage.id}
          stages={stages}
          interviews={interviews.map((item) => item.interview)}
          recruiters={recruiters}
          recruiterId={view.application.recruiterId}
          permissions={permissions}
          related={view.related}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        {(upcoming || (!closed && permissions.interview)) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {upcoming && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">In programma:</span>{" "}
                {INTERVIEW_TYPE_LABELS[upcoming.interview.type]} · {formatSlot(upcoming.interview.scheduledAt)}
              </p>
            )}
            {!closed && permissions.interview && (
              <RegisterCompletedInterviewButton
                candidateId={profile.candidate.id}
                candidateName={profile.fullName}
                applications={[{ id: view.application.id, label: `${view.selection.title} · ${view.company.name}` }]}
                recruiters={recruiters}
                defaultRecruiterId={view.application.recruiterId ?? currentUserId}
                canEvaluate={permissions.evaluate}
              />
            )}
          </div>
        )}

        <details className="group rounded-xl border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            Storico{summary.length > 0 ? `: ${summary.join(", ")}` : ""}
          </summary>
          <ol className="mt-4 space-y-4">
            {history.map((entry) => (
              <li key={entry.key} className="grid gap-3 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                <time dateTime={entry.at.toISOString()} className="text-muted-foreground tabular-nums">
                  {formatDateTime(entry.at)}
                </time>
                {entry.kind === "interview" ? (
                  <InterviewEntry
                    closed={closed}
                    item={entry.item}
                    profile={profile}
                    evaluations={evaluations.filter((evaluation) => evaluation.interviewId === entry.item.interview.id)}
                    feedbacks={feedbacks.filter((feedback) => feedback.interviewId === entry.item.interview.id)}
                    recruiters={recruiters}
                    permissions={permissions}
                  />
                ) : entry.kind === "evaluation" ? (
                  <div className="space-y-1">
                    <p>
                      <span className="font-medium">Esito: {EVALUATION_RESULT_LABELS[entry.evaluation.result]}</span> ·{" "}
                      {entry.evaluation.evaluatedBy.displayName}
                    </p>
                    {entry.evaluation.reason && (
                      <p className="text-muted-foreground">Motivo: {entry.evaluation.reason}</p>
                    )}
                    {entry.evaluation.notes && <p className="text-muted-foreground">{entry.evaluation.notes}</p>}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="whitespace-pre-line">{entry.feedback.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {FEEDBACK_TYPE_LABELS[entry.feedback.type]} · {entry.feedback.author.displayName}
                    </p>
                  </div>
                )}
              </li>
            ))}
            <li className="grid gap-3 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              <time dateTime={view.application.createdAt.toISOString()} className="text-muted-foreground tabular-nums">
                {formatDateTime(view.application.createdAt)}
              </time>
              <p className="text-muted-foreground">Aggiunto alla selezione</p>
            </li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}

function InterviewEntry({
  closed,
  item,
  profile,
  evaluations,
  feedbacks,
  recruiters,
  permissions,
}: {
  closed: boolean;
  item: InterviewItem;
  profile: CandidateProfileView;
  evaluations: CandidateProfileView["evaluations"][string];
  feedbacks: CandidateProfileView["feedbacks"];
  recruiters: UserRef[];
  permissions: PanelPermissions;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {INTERVIEW_TYPE_LABELS[item.interview.type]}
          {item.recruiter && ` · ${item.recruiter.displayName}`}
        </span>
        <InterviewStatusBadge status={item.interview.status} />
        {evaluations.map((evaluation) => (
          <EvaluationBadge key={evaluation.id} result={evaluation.result} />
        ))}
      </div>
      {item.interview.notes && <p className="whitespace-pre-wrap text-muted-foreground">{item.interview.notes}</p>}
      {evaluations.map(
        (evaluation) =>
          (evaluation.reason || evaluation.notes) && (
            <p key={evaluation.id} className="whitespace-pre-wrap">
              {[evaluation.reason, evaluation.notes].filter(Boolean).join(" · ")}
            </p>
          ),
      )}
      {feedbacks.map((feedback) => (
        <p key={feedback.id} className="whitespace-pre-wrap">
          {feedback.content} <span className="text-xs text-muted-foreground">— {feedback.author.displayName}</span>
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        {item.interview.status === "COMPLETED" && (
          <InterviewReportActions
            interview={item.interview}
            candidateName={profile.fullName}
            canEvaluate={permissions.evaluate && !closed}
            canFeedback={permissions.feedback}
          />
        )}
        {permissions.interview && (
          <>
            {!closed && (
              <InterviewEditButton
                interview={item.interview}
                candidateName={profile.fullName}
                recruiters={recruiters}
              />
            )}
            <InterviewDeleteButton interviewId={item.interview.id} candidateName={profile.fullName} />
          </>
        )}
      </div>
    </div>
  );
}

/** Una card per candidatura: fase ed esito in vista, azioni compatte e storico richiudibile. */
export function ApplicationsPanel({
  profile,
  stages,
  recruiters,
  permissions,
  currentUserId,
}: {
  profile: CandidateProfileView;
  stages: RecruitingStage[];
  recruiters: UserRef[];
  permissions: PanelPermissions;
  /** Recruiter proposto per l'esito quando la candidatura non ne ha uno. */
  currentUserId: string;
}) {
  if (profile.applications.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Nessuna candidatura"
        description="Il candidato non è ancora associato a una selezione. Usa “Associa a selezione” nella colonna a sinistra."
      />
    );
  }

  const isClosed = (view: ApplicationViewItem) =>
    view.stage.isTerminal ||
    view.application.closedAt !== null ||
    ["CLOSED", "ARCHIVED"].includes(view.selection.status);
  const open = profile.applications.filter((view) => !isClosed(view));
  const closed = profile.applications.filter(isClosed);
  const card = (view: ApplicationViewItem) => (
    <ApplicationCard
      key={view.application.id}
      view={view}
      profile={profile}
      stages={stages}
      recruiters={recruiters}
      permissions={permissions}
      currentUserId={currentUserId}
    />
  );

  return (
    <div className="space-y-4">
      {open.map(card)}
      {closed.length > 0 &&
        (open.length === 0 ? (
          closed.map(card)
        ) : (
          <details className="rounded-xl border bg-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">Candidature chiuse ({closed.length})</summary>
            <div className="mt-4 space-y-4">{closed.map(card)}</div>
          </details>
        ))}
    </div>
  );
}
