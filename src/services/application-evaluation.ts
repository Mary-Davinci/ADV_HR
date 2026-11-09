import { assertValidEvaluation, type EntityId, type EvaluationResult, type SessionUser } from "@/domain";
import type { ApplicationView, Repositories } from "@/repositories/types";

import { NotFoundError, recordEvent } from "./context";

/** Valutazione e relativo audit partecipano alla stessa transazione del colloquio. */
export async function insertApplicationEvaluation(
  repos: Repositories,
  actor: SessionUser,
  view: ApplicationView,
  input: { result: EvaluationResult; reason: string | null; notes: string | null; interviewId?: EntityId | null },
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
  return evaluation;
}
