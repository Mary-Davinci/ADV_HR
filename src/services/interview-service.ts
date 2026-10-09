import { DomainRuleError, type EntityId } from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type { InterviewInput, InterviewQuery } from "@/repositories/types";

import { NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";

export function createInterviewService(context: ServiceContext) {
  const { store, actor } = context;

  return {
    list(query: InterviewQuery) {
      assertCan(actor, "interview.read");
      return store.interviews.list(query);
    },

    async getDetail(id: EntityId) {
      assertCan(actor, "interview.read");
      const view = await store.interviews.getView(id);
      if (!view) return null;
      const feedbacks = await store.feedbacks.list({ interviewId: id });
      return { ...view, feedbacks };
    },

    async schedule(applicationId: EntityId, input: InterviewInput): Promise<{ id: EntityId }> {
      assertCan(actor, "interview.manage");
      if (input.status === "SCHEDULED" && input.scheduledAt.getTime() < nowOf(context).getTime() - 60 * 60 * 1000) {
        throw new DomainRuleError("Non è possibile programmare un colloquio nel passato.", "INTERVIEW_IN_PAST");
      }
      return store.transaction(async (repos) => {
        const view = await repos.applications.getView(applicationId);
        if (!view) throw new NotFoundError("La candidatura non esiste.");
        const interview = await repos.interviews.create(applicationId, input);
        await repos.applications.touch(applicationId);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "INTERVIEW",
            entityId: interview.id,
            action: "INTERVIEW_SCHEDULED",
            candidateId: view.candidate.id,
            selectionId: view.selection.id,
            companyId: view.company.id,
            metadata: { scheduledAt: input.scheduledAt.toISOString(), type: input.type },
          },
          audit: { entityType: "INTERVIEW", entityId: interview.id, action: "CREATE", changes: { type: input.type } },
        });
        return { id: interview.id };
      });
    },

    async update(id: EntityId, input: InterviewInput): Promise<void> {
      assertCan(actor, "interview.manage");
      await store.transaction(async (repos) => {
        const before = await repos.interviews.getView(id);
        if (!before) throw new NotFoundError("Il colloquio non esiste.");
        await repos.interviews.update(id, input);
        await repos.applications.touch(before.interview.applicationId);

        const statusChanged = before.interview.status !== input.status;
        const action = !statusChanged
          ? "INTERVIEW_UPDATED"
          : input.status === "COMPLETED"
            ? "INTERVIEW_COMPLETED"
            : input.status === "CANCELLED" || input.status === "NO_SHOW"
              ? "INTERVIEW_CANCELLED"
              : "INTERVIEW_UPDATED";

        const context = {
          candidateId: before.candidate.id,
          selectionId: before.selection.id,
          companyId: before.company.id,
        };
        await recordEvent(repos, actor, {
          activity: {
            entityType: "INTERVIEW",
            entityId: id,
            action,
            ...context,
            metadata: { status: input.status, scheduledAt: input.scheduledAt.toISOString() },
          },
          audit: {
            entityType: "INTERVIEW",
            entityId: id,
            action: "UPDATE",
            changes: { from: before.interview.status, to: input.status },
          },
        });
        // Un colloquio svolto è un contatto con il candidato: alimenta "ultimo contatto".
        if (action === "INTERVIEW_COMPLETED") {
          await recordEvent(repos, actor, {
            activity: { entityType: "INTERVIEW", entityId: id, action: "INTERVIEW", ...context, metadata: {} },
          });
        }
      });
    },
  };
}
