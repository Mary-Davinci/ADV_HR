import {
  assertValidEvaluation,
  DomainRuleError,
  INITIAL_STAGE_CODE,
  REJECTION_STAGE_CODE,
  type ApplicationSource,
  type EntityId,
  type EvaluationResult,
  type FeedbackType,
} from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type { ApplicationView, Repositories } from "@/repositories/types";

import { ConflictError, NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";

function contextOf(view: ApplicationView) {
  return { candidateId: view.candidate.id, selectionId: view.selection.id, companyId: view.company.id };
}

export function createApplicationService(context: ServiceContext) {
  const { store, actor } = context;

  async function requireView(repos: Repositories, id: EntityId): Promise<ApplicationView> {
    const view = await repos.applications.getView(id);
    if (!view) throw new NotFoundError("La candidatura non esiste.");
    return view;
  }

  async function insertEvaluation(
    repos: Repositories,
    view: ApplicationView,
    input: { result: EvaluationResult; reason: string | null; notes: string | null },
  ) {
    assertValidEvaluation(input);
    const evaluation = await repos.applications.addEvaluation({
      applicationId: view.application.id,
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
        ...contextOf(view),
        metadata: { result: input.result },
      },
      // La motivazione può contenere valutazioni personali: nell'audit solo il fatto che esista.
      audit: {
        entityType: "APPLICATION",
        entityId: view.application.id,
        action: "EVALUATE",
        changes: { result: input.result, reasonProvided: Boolean(input.reason?.trim()) },
      },
    });
    return evaluation;
  }

  const service = {
    async listForSelection(selectionId: EntityId) {
      assertCan(actor, "application.read");
      return store.applications.list({ selectionId });
    },

    async getView(id: EntityId) {
      assertCan(actor, "application.read");
      const view = await store.applications.getView(id);
      if (!view) return null;
      const [evaluations, feedbacks, interviews, timeline] = await Promise.all([
        store.applications.listEvaluations(id),
        store.feedbacks.list({ applicationId: id }),
        store.interviews.list({ applicationId: id, order: "desc" }),
        store.activities.list({ entity: { type: "APPLICATION", id }, limit: 100 }),
      ]);
      return { view, evaluations, feedbacks, interviews: interviews.items, timeline };
    },

    /**
     * Toglie il candidato dalla selezione (es. aggiunto per errore). Valutazioni,
     * feedback e colloqui della candidatura vengono eliminati a cascata: l'interfaccia
     * li elenca nella conferma. Con documenti collegati la rimozione è bloccata,
     * per non lasciare file orfani nello storage. Il candidato resta in archivio.
     */
    async remove(id: EntityId): Promise<void> {
      assertCan(actor, "application.manage");
      const view = await store.applications.getView(id);
      if (!view) throw new NotFoundError("La candidatura non esiste più.");
      if (view.related.documents > 0) {
        throw new DomainRuleError(
          "La candidatura ha documenti collegati: eliminali prima di rimuoverla dalla selezione.",
          "APPLICATION_HAS_DOCUMENTS",
        );
      }
      await store.transaction(async (repos) => {
        await recordEvent(repos, actor, {
          activity: {
            entityType: "APPLICATION",
            entityId: id,
            action: "APPLICATION_REMOVED",
            candidateId: view.candidate.id,
            selectionId: view.selection.id,
            companyId: view.company.id,
            metadata: { selectionTitle: view.selection.title, stage: view.stage.code },
          },
          audit: {
            entityType: "APPLICATION",
            entityId: id,
            action: "DELETE",
            changes: {
              stage: view.stage.code,
              evaluations: view.related.evaluations,
              feedbacks: view.related.feedbacks,
              interviews: view.related.interviews,
            },
          },
        });
        await repos.applications.delete(id);
      });
    },

    async create(input: {
      candidateId: EntityId;
      selectionId: EntityId;
      recruiterId: EntityId | null;
      source: ApplicationSource;
    }): Promise<{ id: EntityId }> {
      assertCan(actor, "application.manage");
      const [candidate, selection, initialStage] = await Promise.all([
        store.candidates.getById(input.candidateId),
        store.selections.getById(input.selectionId),
        store.stages.getByCode(INITIAL_STAGE_CODE),
      ]);
      if (!candidate) throw new NotFoundError("Il candidato non esiste.");
      if (!selection) throw new NotFoundError("La selezione non esiste.");
      if (!initialStage) throw new NotFoundError("Stage iniziale della pipeline non configurato.");
      if (["CLOSED", "ARCHIVED"].includes(selection.selection.status)) {
        throw new DomainRuleError("Non è possibile aggiungere candidati a una selezione chiusa.", "SELECTION_CLOSED");
      }
      if (await store.applications.exists(input.candidateId, input.selectionId)) {
        throw new ConflictError("Il candidato è già associato a questa selezione.");
      }

      return store.transaction(async (repos) => {
        const application = await repos.applications.create({ ...input, stageId: initialStage.id });
        await recordEvent(repos, actor, {
          activity: {
            entityType: "APPLICATION",
            entityId: application.id,
            action: "APPLICATION_CREATED",
            candidateId: input.candidateId,
            selectionId: input.selectionId,
            companyId: selection.selection.companyId,
            metadata: { selectionTitle: selection.selection.title, source: input.source },
          },
          audit: {
            entityType: "APPLICATION",
            entityId: application.id,
            action: "CREATE",
            changes: { source: input.source },
          },
        });
        return { id: application.id };
      });
    },

    /**
     * Aggiunge più candidati alla stessa selezione (es. i compatibili scelti da HR).
     * Ogni candidatura passa dalle stesse regole di `create`; chi è già in selezione
     * viene saltato, non è un errore.
     */
    async createMany(input: {
      selectionId: EntityId;
      candidateIds: EntityId[];
      source: ApplicationSource;
    }): Promise<{ added: number; skipped: number }> {
      assertCan(actor, "application.manage");
      let added = 0;
      let skipped = 0;
      for (const candidateId of new Set(input.candidateIds)) {
        try {
          await service.create({
            candidateId,
            selectionId: input.selectionId,
            recruiterId: null,
            source: input.source,
          });
          added++;
        } catch (error) {
          if (!(error instanceof ConflictError)) throw error;
          skipped++;
        }
      }
      return { added, skipped };
    },

    /**
     * Cambio stage: aggiorna la candidatura, registra activity e audit in un'unica
     * transazione. Verso lo stage di scarto la motivazione è obbligatoria.
     */
    async changeStage(applicationId: EntityId, input: { stageId: EntityId; reason?: string | null }): Promise<void> {
      assertCan(actor, "application.manage");
      await store.transaction(async (repos) => {
        const view = await requireView(repos, applicationId);
        const target = await repos.stages.getById(input.stageId);
        if (!target || !target.active) throw new NotFoundError("Stage non valido.");
        if (target.id === view.stage.id) return;

        const isRejection = target.code === REJECTION_STAGE_CODE;
        if (isRejection) {
          if (!input.reason?.trim()) {
            throw new DomainRuleError(
              "Per scartare una candidatura è obbligatorio indicare il motivo.",
              "REASON_REQUIRED",
            );
          }
        }

        await repos.applications.updateStage(applicationId, target.id, target.isTerminal ? nowOf(context) : null);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "STATUS_CHANGED",
            ...contextOf(view),
            metadata: { from: view.stage.code, to: target.code, fromLabel: view.stage.label, toLabel: target.label },
          },
          audit: {
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "STAGE_CHANGE",
            changes: { from: view.stage.code, to: target.code },
          },
        });

        if (isRejection) {
          await insertEvaluation(repos, view, { result: "NOT_SUITABLE", reason: input.reason ?? null, notes: null });
        }
      });
    },

    async evaluate(
      applicationId: EntityId,
      input: { result: EvaluationResult; reason: string | null; notes: string | null },
    ): Promise<void> {
      assertCan(actor, "evaluation.manage");
      assertValidEvaluation(input);
      await store.transaction(async (repos) => {
        const view = await requireView(repos, applicationId);
        await insertEvaluation(repos, view, input);
      });
    },

    async addFeedback(
      applicationId: EntityId,
      input: { type: FeedbackType; content: string; interviewId: EntityId | null },
    ): Promise<void> {
      assertCan(actor, "feedback.manage");
      await store.transaction(async (repos) => {
        const view = await requireView(repos, applicationId);
        if (input.interviewId) {
          const interview = await repos.interviews.getById(input.interviewId);
          if (!interview || interview.applicationId !== applicationId)
            throw new NotFoundError("Colloquio non trovato.");
        }
        const feedback = await repos.feedbacks.create({
          applicationId,
          interviewId: input.interviewId,
          authorId: actor.id,
          type: input.type,
          content: input.content.trim(),
        });
        await repos.applications.touch(applicationId);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "FEEDBACK_ADDED",
            ...contextOf(view),
            metadata: { type: input.type },
          },
          audit: {
            entityType: "APPLICATION",
            entityId: feedback.id,
            action: "CREATE",
            changes: { kind: "feedback", type: input.type },
          },
        });
      });
    },

    async assignRecruiter(applicationId: EntityId, recruiterId: EntityId | null): Promise<void> {
      assertCan(actor, "application.manage");
      await store.transaction(async (repos) => {
        const view = await requireView(repos, applicationId);
        if (view.application.recruiterId === recruiterId) return;
        await repos.applications.assignRecruiter(applicationId, recruiterId);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "UPDATED",
            ...contextOf(view),
            metadata: { field: "recruiter" },
          },
          audit: {
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "UPDATE",
            changes: { fields: ["recruiter"] },
          },
        });
      });
    },

    listStages() {
      return store.stages.list();
    },
  };
  return service;
}

export type ApplicationService = ReturnType<typeof createApplicationService>;
