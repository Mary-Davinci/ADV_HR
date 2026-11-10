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
import { AdvanceStageButton } from "@/features/recruiting/components/advance-stage-button";
import { ApplicationActions } from "@/features/recruiting/components/application-actions";
import { EvaluationBadge, InterviewStatusBadge, StageBadge } from "@/features/recruiting/components/badges";
import { stagePath } from "@/features/recruiting/stage-path";
import { formatDate, formatDateTime, formatSlot, formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
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

/** Barra delle fasi: completate, attuale, da fare; esiti finali e fasi fuori percorso come etichetta. */
function StageProgress({ stages, current }: { stages: RecruitingStage[]; current: RecruitingStage }) {
  const path = stagePath(stages, current);
  const reached = path.outcome ? path.steps.length : path.currentIndex;
  return (
    <div className="space-y-2">
      <ol
        aria-label={`Fase della selezione: ${current.label}`}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.max(path.steps.length, 1)}, minmax(0, 1fr))` }}
      >
        {path.steps.map((step, index) => {
          const isCurrent = index === path.currentIndex;
          return (
            <li key={step.id} aria-current={isCurrent ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 rounded-full",
                  isCurrent ? "bg-primary" : index < reached ? "bg-[#c9a24a]" : "bg-muted",
                )}
              />
              <span
                className={cn(
                  "truncate text-xs",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
                title={step.label}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {(path.outcome ?? path.aside) && (
        <p className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{path.outcome ? "Esito:" : "Fase attuale:"}</span>
          <StageBadge code={current.code} label={current.label} />
        </p>
      )}
    </div>
  );
}

/** Colloquio più recente già svolto (o passato); in mancanza, il più recente in assoluto. */
function lastInterview(interviews: InterviewItem[], now: Date) {
  const sorted = [...interviews].sort((a, b) => b.interview.scheduledAt.getTime() - a.interview.scheduledAt.getTime());
  return (
    sorted.find((item) => item.interview.status === "COMPLETED" || item.interview.scheduledAt <= now) ??
    sorted[0] ??
    null
  );
}

function ApplicationCard({
  view,
  profile,
  stages,
  recruiters,
  permissions,
}: {
  view: ApplicationViewItem;
  profile: CandidateProfileView;
  stages: RecruitingStage[];
  recruiters: UserRef[];
  permissions: PanelPermissions;
}) {
  const now = new Date();
  const evaluations = profile.evaluations[view.application.id] ?? [];
  const feedbacks = profile.feedbacks.filter((feedback) => feedback.applicationId === view.application.id);
  const interviews = profile.interviews.filter((item) => item.interview.applicationId === view.application.id);
  const last = lastInterview(interviews, now);
  const lastOutcome = last ? evaluations.find((evaluation) => evaluation.interviewId === last.interview.id) : null;
  const upcoming = interviews
    .filter((item) => item.interview.status === "SCHEDULED" && item.interview.scheduledAt > now)
    .sort((a, b) => a.interview.scheduledAt.getTime() - b.interview.scheduledAt.getTime())[0];
  const next = stagePath(stages, view.stage).next;
  const closed = view.stage.isTerminal || view.application.closedAt !== null;
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
        </div>
        <ApplicationActions
          compact
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

      <CardContent className="space-y-5">
        <StageProgress stages={stages} current={view.stage} />

        <div className="grid gap-3 md:grid-cols-2">
          <section aria-label="Ultimo colloquio" className="space-y-1.5 rounded-xl border p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Ultimo colloquio</p>
            {last ? (
              <>
                <p className="font-medium">
                  {INTERVIEW_TYPE_LABELS[last.interview.type]} · {formatSlot(last.interview.scheduledAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {last.interview.status === "COMPLETED" ? "Svolto da " : "Con "}
                  {last.recruiter?.displayName ?? "recruiter non indicato"}
                  {last.interview.durationMinutes && ` · ${last.interview.durationMinutes} min`}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <InterviewStatusBadge status={last.interview.status} />
                  {lastOutcome && <EvaluationBadge result={lastOutcome.result} />}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nessun colloquio registrato.</p>
            )}
          </section>

          <section aria-label="Prossimo passo" className="space-y-1.5 rounded-xl border p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Prossimo passo</p>
            {closed ? (
              <p className="font-medium">Candidatura chiusa · {view.stage.label}</p>
            ) : upcoming ? (
              <>
                <p className="font-medium">
                  {INTERVIEW_TYPE_LABELS[upcoming.interview.type]} · {formatSlot(upcoming.interview.scheduledAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {upcoming.interview.location ?? upcoming.interview.meetingUrl ?? "Luogo da definire"}
                </p>
              </>
            ) : (
              <p className="font-medium">Nessun colloquio in programma</p>
            )}
            <p className="text-sm text-muted-foreground">
              Ultimo contatto: {view.lastContactAt ? formatTimeAgo(view.lastContactAt) : "nessuno"}
            </p>
            {!closed && (permissions.manage || permissions.interview) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {permissions.manage && next && (
                  <AdvanceStageButton
                    applicationId={view.application.id}
                    candidateName={profile.fullName}
                    stage={{ id: next.id, label: next.label }}
                  />
                )}
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
            )}
          </section>
        </div>

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
  item,
  profile,
  evaluations,
  feedbacks,
  recruiters,
  permissions,
}: {
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
            canEvaluate={permissions.evaluate}
            canFeedback={permissions.feedback}
          />
        )}
        {permissions.interview && (
          <>
            <InterviewEditButton interview={item.interview} candidateName={profile.fullName} recruiters={recruiters} />
            <InterviewDeleteButton interviewId={item.interview.id} candidateName={profile.fullName} />
          </>
        )}
      </div>
    </div>
  );
}

/** Una card per candidatura: fasi, ultimo colloquio e prossimo passo in vista, storico richiudibile. */
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
        description="Il candidato non è ancora associato a una selezione. Usa “Associa a selezione” nella colonna a sinistra."
      />
    );
  }

  const isClosed = (view: ApplicationViewItem) => view.stage.isTerminal || view.application.closedAt !== null;
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
