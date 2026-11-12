import { assertValidEvaluation, type EntityId, type EvaluationResult, type SessionUser } from "@/domain";
import type { ApplicationView, Repositories } from "@/repositories/types";

import { NotFoundError, recordEvent } from "./context";
import { moveApplication } from "./recruiting-lifecycle";

/** Valutazione e relativo audit partecipano alla stessa transazione del colloquio. */
export async function insertApplicationEvaluation(
  repos: Repositories,
  actor: SessionUser,
  view: ApplicationView,
  input: { result: EvaluationResult; reason: string | null; notes: string | null; interviewId?: EntityId | null },
  now = new Date(),
) {
  assertValidEvaluation(input);
  if (input.interviewId) {
    const interview = await repos.interviews.getById(input.interviewId);
    if (!interview || interview.applicationId !== view.application.id || interview.status !== "COMPLETED") {
      throw new NotFoundError("Il colloquio svolto non appartiene a questa candidatura.");
    }
  }
  const evaluation = await repos.applications.addEvaluation({
    applicationId: view.application.id,
    interviewId: input.interviewId ?? null,
    result: input.result,
    reason: input.reason?.trim() || null,
    notes: input.notes?.trim() || null,
    evaluatedBy: actor.id,
  });
  await repos.applications.touch(view.application.id);
  await recordEvent(repos, actor, {
    activity: {
      entityType: "APPLICATION",
      entityId: view.application.id,
      action: "EVALUATION_ADDED",
      candidateId: view.candidate.id,
      selectionId: view.selection.id,
      companyId: view.company.id,
      metadata: { result: input.result, interviewId: input.interviewId ?? null },
    },
    audit: {
      entityType: "APPLICATION",
      entityId: view.application.id,
      action: "EVALUATE",
      changes: {
        result: input.result,
        reasonProvided: Boolean(input.reason?.trim()),
        interviewId: input.interviewId ?? null,
      },
    },
  });
  const early = ["NEW", "TO_REVIEW", "CONTACTED", "INTERVIEW_SCHEDULED"].includes(view.stage.code);
  const pending =
    input.result === "SUITABLE" && early
      ? await repos.interviews.count({ applicationId: view.application.id, statuses: ["SCHEDULED"] })
      : 0;
  const suitableStage = early ? (pending ? "INTERVIEW_SCHEDULED" : "INTERVIEWED") : view.stage.code;
  await moveApplication(
    repos,
    actor,
    view,
    input.result === "NOT_SUITABLE" ? "REJECTED" : input.result === "SUITABLE" ? suitableStage : "TO_REVIEW",
    now,
  );
  return evaluation;
}
