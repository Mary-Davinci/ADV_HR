import { DomainRuleError, type SessionUser } from "@/domain";
import type { ApplicationView, Repositories } from "@/repositories/types";

import { NotFoundError, recordEvent } from "./context";

export function assertApplicationOpen(view: ApplicationView) {
  if (["CLOSED", "ARCHIVED"].includes(view.selection.status)) {
    throw new DomainRuleError("La selezione è chiusa.", "SELECTION_CLOSED");
  }
  if (view.application.closedAt || view.stage.isTerminal) {
    throw new DomainRuleError("La candidatura è chiusa.", "APPLICATION_CLOSED");
  }
}

export async function cancelScheduledInterviews(repos: Repositories, actor: SessionUser, view: ApplicationView) {
  const cancelled = await repos.interviews.cancelScheduled(view.application.id);
  for (const interview of cancelled) {
    await recordEvent(repos, actor, {
      activity: {
        entityType: "INTERVIEW",
        entityId: interview.id,
        action: "INTERVIEW_CANCELLED",
        candidateId: view.candidate.id,
        selectionId: view.selection.id,
        companyId: view.company.id,
        metadata: { reason: "APPLICATION_CLOSED" },
      },
      audit: {
        entityType: "INTERVIEW",
        entityId: interview.id,
        action: "UPDATE",
        changes: { from: "SCHEDULED", to: "CANCELLED" },
      },
    });
  }
}

export async function moveApplication(
  repos: Repositories,
  actor: SessionUser,
  view: ApplicationView,
  code: string,
  now: Date,
) {
  const target = await repos.stages.getByCode(code);
  if (!target?.active) throw new NotFoundError("Fase della candidatura non configurata: " + code);
  if (target.id !== view.stage.id) {
    await repos.applications.updateStage(view.application.id, target.id, target.isTerminal ? now : null);
    await recordEvent(repos, actor, {
      activity: {
        entityType: "APPLICATION",
        entityId: view.application.id,
        action: "STATUS_CHANGED",
        candidateId: view.candidate.id,
        selectionId: view.selection.id,
        companyId: view.company.id,
        metadata: { from: view.stage.code, to: target.code, fromLabel: view.stage.label, toLabel: target.label },
      },
      audit: {
        entityType: "APPLICATION",
        entityId: view.application.id,
        action: "STAGE_CHANGE",
        changes: { from: view.stage.code, to: target.code },
      },
    });
  }
  if (target.isTerminal) await cancelScheduledInterviews(repos, actor, view);
}

export async function syncInterviewStage(repos: Repositories, actor: SessionUser, applicationId: string, now: Date) {
  const view = await repos.applications.getView(applicationId);
  if (
    !view ||
    view.application.closedAt ||
    view.stage.isTerminal ||
    ["CLOSED", "ARCHIVED"].includes(view.selection.status)
  )
    return;
  if (!["NEW", "TO_REVIEW", "CONTACTED", "INTERVIEW_SCHEDULED", "INTERVIEWED"].includes(view.stage.code)) return;
  const pending = await repos.interviews.count({ applicationId, statuses: ["SCHEDULED"] });
  const completed = await repos.interviews.count({ applicationId, statuses: ["COMPLETED"] });
  const code = pending
    ? "INTERVIEW_SCHEDULED"
    : completed
      ? "INTERVIEWED"
      : view.stage.code === "INTERVIEW_SCHEDULED" || view.stage.code === "INTERVIEWED"
        ? "CONTACTED"
        : view.stage.code;
  await moveApplication(repos, actor, view, code, now);
}
