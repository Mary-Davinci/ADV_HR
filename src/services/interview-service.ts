import { assertValidEvaluation, DomainRuleError, type EntityId } from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type { CompletedInterviewInput, InterviewInput, InterviewQuery } from "@/repositories/types";

import { insertApplicationEvaluation } from "./application-evaluation";
import { assertApplicationOpen, syncInterviewStage } from "./recruiting-lifecycle";
import { NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";

export function createInterviewService(context: ServiceContext) {
  const { store, actor } = context;

  function validateDate(input: InterviewInput) {
    const time = input.scheduledAt.getTime();
    const now = nowOf(context).getTime();
    if (!Number.isFinite(time)) throw new DomainRuleError("Data del colloquio non valida.", "INVALID_DATE");
    if (input.status === "COMPLETED" && time > now)
      throw new DomainRuleError("Un colloquio futuro non può essere segnato come svolto.", "INTERVIEW_NOT_COMPLETED");
    if (input.status === "SCHEDULED" && time < now - 60 * 60 * 1000)
      throw new DomainRuleError("Non è possibile programmare un colloquio nel passato.", "INTERVIEW_IN_PAST");
  }

  return {
    list(query: InterviewQuery) {
      assertCan(actor, "interview.read");
      return store.interviews.list(query);
    },

    listHistory(query: InterviewQuery & { concludedBy: Date }) {
      assertCan(actor, "interview.read");
      return store.interviews.listHistory(query);
    },

    async getDetail(id: EntityId) {
      assertCan(actor, "interview.read");
      const view = await store.interviews.getView(id);
      if (!view) return null;
      const feedbacks = await store.feedbacks.list({ interviewId: id });
      return { ...view, feedbacks };
    },

    async recordCompleted(candidateId: EntityId, applicationId: EntityId, input: CompletedInterviewInput) {
      assertCan(actor, "interview.manage");
      if (input.result) {
        assertCan(actor, "evaluation.manage");
        assertValidEvaluation({ result: input.result, reason: input.reason });
      }
      const now = nowOf(context);
      if (!Number.isFinite(input.scheduledAt.getTime()) || input.scheduledAt.getTime() > now.getTime()) {
        throw new DomainRuleError("Indica la data e l'ora di un colloquio già svolto.", "INTERVIEW_NOT_COMPLETED");
      }
      if (!input.notes.trim()) throw new DomainRuleError("Scrivi il resoconto del colloquio.", "REPORT_REQUIRED");
      return store.transaction(async (repos) => {
        const view = await repos.applications.getView(applicationId);
        if (!view || view.candidate.id !== candidateId) throw new NotFoundError("Candidatura non trovata.");
        assertApplicationOpen(view);
        const recruiters = await repos.users.listRecruiters();
        if (!recruiters.some((recruiter) => recruiter.id === input.recruiterId)) {
          throw new NotFoundError("Seleziona il recruiter che ha svolto il colloquio.");
        }
        const interview = await repos.interviews.create(applicationId, {
          scheduledAt: input.scheduledAt,
          durationMinutes: input.durationMinutes,
          type: input.type,
          recruiterId: input.recruiterId,
          status: "COMPLETED",
          notes: input.notes.trim(),
          location: null,
          meetingUrl: null,
        });
        const eventContext = { candidateId, selectionId: view.selection.id, companyId: view.company.id };
        await recordEvent(repos, actor, {
          activity: {
            entityType: "INTERVIEW",
            entityId: interview.id,
            action: "INTERVIEW_COMPLETED",
            ...eventContext,
            metadata: {
              scheduledAt: input.scheduledAt.toISOString(),
              type: input.type,
              recruiterId: input.recruiterId,
            },
          },
          audit: {
            entityType: "INTERVIEW",
            entityId: interview.id,
            action: "CREATE",
            changes: { status: "COMPLETED", type: input.type },
          },
        });
        await recordEvent(repos, actor, {
          activity: {
            entityType: "INTERVIEW",
            entityId: interview.id,
            action: "INTERVIEW",
            ...eventContext,
            createdAt: input.scheduledAt,
            metadata: { recordedAt: now.toISOString() },
          },
        });
        if (input.result) {
          await insertApplicationEvaluation(
            repos,
            actor,
            view,
            {
              result: input.result,
              reason: input.reason,
              notes: null,
              interviewId: interview.id,
            },
            now,
          );
        }
        if (!input.result) await syncInterviewStage(repos, actor, applicationId, now);
        await repos.applications.touch(applicationId);
        return { id: interview.id };
      });
    },

    async schedule(applicationId: EntityId, input: InterviewInput): Promise<{ id: EntityId }> {
      assertCan(actor, "interview.manage");
      validateDate(input);
      return store.transaction(async (repos) => {
        const view = await repos.applications.getView(applicationId);
        if (!view) throw new NotFoundError("La candidatura non esiste.");
        assertApplicationOpen(view);
        if (await repos.interviews.hasOverlap(input))
          throw new DomainRuleError(
            "Il recruiter ha già un colloquio in questo orario. Scegli un altro orario o recruiter.",
            "INTERVIEW_OVERLAP",
          );
        const interview = await repos.interviews.create(applicationId, input);
        await syncInterviewStage(repos, actor, applicationId, nowOf(context));
        await repos.applications.touch(applicationId);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "INTERVIEW",
            entityId: interview.id,
            action:
              input.status === "COMPLETED"
                ? "INTERVIEW_COMPLETED"
                : input.status === "SCHEDULED"
                  ? "INTERVIEW_SCHEDULED"
                  : "INTERVIEW_CANCELLED",
            candidateId: view.candidate.id,
            selectionId: view.selection.id,
            companyId: view.company.id,
            metadata: { scheduledAt: input.scheduledAt.toISOString(), type: input.type },
          },
          audit: { entityType: "INTERVIEW", entityId: interview.id, action: "CREATE", changes: { type: input.type } },
        });
        if (input.status === "COMPLETED") {
          await recordEvent(repos, actor, {
            activity: {
              entityType: "INTERVIEW",
              entityId: interview.id,
              action: "INTERVIEW",
              candidateId: view.candidate.id,
              selectionId: view.selection.id,
              companyId: view.company.id,
              createdAt: input.scheduledAt,
              metadata: {},
            },
          });
        }
        return { id: interview.id };
      });
    },

    async remove(id: EntityId): Promise<void> {
      assertCan(actor, "interview.manage");
      await store.transaction(async (repos) => {
        const before = await repos.interviews.getById(id);
        if (!before) throw new NotFoundError("Il colloquio non esiste più.");
        const removed = await repos.interviews.delete(id);
        if (!removed) throw new NotFoundError("Il colloquio non esiste più.");
        await repos.applications.touch(before.applicationId);
        await syncInterviewStage(repos, actor, before.applicationId, nowOf(context));
        await recordEvent(repos, actor, {
          audit: {
            entityType: "INTERVIEW",
            entityId: id,
            action: "DELETE",
            changes: { applicationId: before.applicationId, status: before.status },
          },
        });
      });
    },

    async update(id: EntityId, input: InterviewInput): Promise<void> {
      assertCan(actor, "interview.manage");
      validateDate(input);
      await store.transaction(async (repos) => {
        const before = await repos.interviews.getView(id);
        if (!before) throw new NotFoundError("Il colloquio non esiste.");
        const application = await repos.applications.getView(before.interview.applicationId);
        if (!application) throw new NotFoundError("La candidatura non esiste.");
        assertApplicationOpen(application);
        if (await repos.interviews.hasOverlap(input, id))
          throw new DomainRuleError(
            "Il recruiter ha già un colloquio in questo orario. Scegli un altro orario o recruiter.",
            "INTERVIEW_OVERLAP",
          );
        await repos.interviews.update(id, input);
        await syncInterviewStage(repos, actor, before.interview.applicationId, nowOf(context));
        await repos.applications.touch(before.interview.applicationId);

        const statusChanged = before.interview.status !== input.status;
        const action = !statusChanged
          ? "INTERVIEW_UPDATED"
          : input.status === "COMPLETED"
            ? "INTERVIEW_COMPLETED"
            : input.status === "CANCELLED" || input.status === "NO_SHOW"
              ? "INTERVIEW_CANCELLED"
              : "INTERVIEW_UPDATED";

        const eventContext = {
          candidateId: before.candidate.id,
          selectionId: before.selection.id,
          companyId: before.company.id,
        };
        await recordEvent(repos, actor, {
          activity: {
            entityType: "INTERVIEW",
            entityId: id,
            action,
            ...eventContext,
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
            activity: {
              entityType: "INTERVIEW",
              entityId: id,
              action: "INTERVIEW",
              ...eventContext,
              createdAt: input.scheduledAt,
              metadata: {},
            },
          });
        }
      });
    },
  };
}
