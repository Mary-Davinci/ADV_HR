import {
  getCandidateFullName,
  type Activity,
  type ApplicationEvaluation,
  type ContactAction,
  type DocumentMetadata,
  type EntityId,
  type Page,
} from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type {
  ApplicationView,
  CandidateAggregate,
  CandidateCollectionInput,
  CandidateCollectionKind,
  CandidateIdentityInput,
  CandidateListItem,
  CandidatePreferencesInput,
  CandidateProfileInput,
  CandidateSearchQuery,
  CandidateSkillInput,
  FeedbackView,
  InterviewView,
} from "@/repositories/types";

import { changedFields, ConflictError, NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";

/** Tutto ciò che serve alla scheda candidato, caricato in un'unica chiamata. */
export interface CandidateProfileView extends CandidateAggregate {
  fullName: string;
  applications: ApplicationView[];
  /** Storico valutazioni per candidatura (più recenti prima). */
  evaluations: Record<EntityId, ApplicationEvaluation[]>;
  interviews: InterviewView[];
  feedbacks: FeedbackView[];
  documents: DocumentMetadata[];
  timeline: Activity[];
  talentPools: Array<{ id: EntityId; name: string }>;
  /** Derivato dalle activity di contatto: mai inserito manualmente. */
  lastContactAt: Date | null;
  /** Recruiter della candidatura aperta più recente. */
  primaryRecruiter: { id: EntityId; displayName: string } | null;
  /** Prossimo colloquio; se non ce ne sono, l'ultimo ancora "programmato" ma già passato (da aggiornare). */
  nextInterview: InterviewView | null;
  nextInterviewOverdue: boolean;
}

const COLLECTION_LABELS: Record<CandidateCollectionKind, string> = {
  experiences: "esperienza",
  education: "formazione",
  interests: "interesse",
  languages: "lingua",
  certifications: "certificazione",
  drivingLicenses: "patente",
  activePolicies: "politica attiva",
};

export function createCandidateService(context: ServiceContext) {
  const { store, actor } = context;

  async function requireCandidate(id: EntityId) {
    const candidate = await store.candidates.getById(id);
    if (!candidate) throw new NotFoundError("Il candidato non esiste.");
    return candidate;
  }

  /** Modifica rilevante: aggiorna last_reviewed_at + activity + audit, nella stessa transazione. */
  async function afterProfileChange(
    repos: Parameters<Parameters<typeof store.transaction>[0]>[0],
    candidateId: EntityId,
    section: string,
    fields: string[],
    action: "UPDATE" | "CREATE" | "DELETE" = "UPDATE",
  ) {
    await repos.candidates.markReviewed(candidateId, nowOf(context));
    await recordEvent(repos, actor, {
      activity: {
        entityType: "CANDIDATE",
        entityId: candidateId,
        action: "UPDATED",
        candidateId,
        metadata: { section, fields },
      },
      audit: { entityType: "CANDIDATE", entityId: candidateId, action, changes: { section, fields } },
    });
  }

  return {
    async search(query: CandidateSearchQuery): Promise<Page<CandidateListItem>> {
      assertCan(actor, "candidate.read");
      return store.candidates.search(query);
    },

    async getProfile(id: EntityId): Promise<CandidateProfileView | null> {
      assertCan(actor, "candidate.read");
      const aggregate = await store.candidates.getAggregate(id);
      if (!aggregate) return null;

      const [applications, interviews, feedbacks, documents, timeline, talentPools, lastContactAt] = await Promise.all([
        store.applications.list({ candidateId: id }),
        store.interviews.list({ candidateId: id, order: "desc", limit: 100 }),
        store.feedbacks.list({ candidateId: id }),
        store.documents.list({ candidateId: id }),
        store.activities.list({ candidateId: id, limit: 100 }),
        store.talentPools.poolsOfCandidate(id),
        store.activities.lastContactAt(id),
      ]);

      const evaluationLists = await Promise.all(
        applications.map((view) => store.applications.listEvaluations(view.application.id)),
      );
      const evaluations = Object.fromEntries(
        applications.map((view, index) => [view.application.id, evaluationLists[index] ?? []]),
      );

      const now = nowOf(context).getTime();
      const upcoming = interviews.items
        .filter((view) => view.interview.status === "SCHEDULED" && view.interview.scheduledAt.getTime() >= now)
        .sort((a, b) => a.interview.scheduledAt.getTime() - b.interview.scheduledAt.getTime());
      const overdue = interviews.items.find(
        (view) => view.interview.status === "SCHEDULED" && view.interview.scheduledAt.getTime() < now,
      );
      const openApplication = applications
        .filter((view) => !view.stage.isTerminal && view.application.closedAt === null)
        .sort((a, b) => b.application.updatedAt.getTime() - a.application.updatedAt.getTime())[0];

      return {
        ...aggregate,
        fullName: getCandidateFullName(aggregate.candidate),
        applications,
        evaluations,
        interviews: interviews.items,
        feedbacks,
        documents,
        timeline,
        talentPools,
        lastContactAt,
        primaryRecruiter: openApplication?.recruiter ?? applications[0]?.recruiter ?? null,
        nextInterview: upcoming[0] ?? overdue ?? null,
        nextInterviewOverdue: !upcoming[0] && Boolean(overdue),
      };
    },

    async create(input: CandidateIdentityInput): Promise<{ id: EntityId }> {
      assertCan(actor, "candidate.create");
      if (input.fiscalCode && (await store.candidates.findByFiscalCode(input.fiscalCode))) {
        throw new ConflictError("Esiste già un candidato con questo codice fiscale.");
      }
      return store.transaction(async (repos) => {
        const candidate = await repos.candidates.create(input);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "CANDIDATE",
            entityId: candidate.id,
            action: "CREATED",
            candidateId: candidate.id,
            metadata: {},
          },
          audit: { entityType: "CANDIDATE", entityId: candidate.id, action: "CREATE" },
        });
        return { id: candidate.id };
      });
    },

    async updateIdentity(id: EntityId, input: CandidateIdentityInput): Promise<void> {
      assertCan(actor, "candidate.edit");
      const before = await requireCandidate(id);
      if (input.fiscalCode) {
        const other = await store.candidates.findByFiscalCode(input.fiscalCode);
        if (other && other.id !== id) throw new ConflictError("Esiste già un candidato con questo codice fiscale.");
      }
      await store.transaction(async (repos) => {
        await repos.candidates.updateIdentity(id, input);
        await afterProfileChange(repos, id, "identity", changedFields(before, input));
      });
    },

    async updateProfile(id: EntityId, input: CandidateProfileInput): Promise<void> {
      assertCan(actor, "candidate.edit");
      const aggregate = await store.candidates.getAggregate(id);
      if (!aggregate) throw new NotFoundError("Il candidato non esiste.");
      await store.transaction(async (repos) => {
        await repos.candidates.upsertProfile(id, input, nowOf(context));
        await afterProfileChange(repos, id, "profile", changedFields(aggregate.profile, input));
      });
    },

    async updatePreferences(id: EntityId, input: CandidatePreferencesInput): Promise<void> {
      assertCan(actor, "candidate.edit");
      const aggregate = await store.candidates.getAggregate(id);
      if (!aggregate) throw new NotFoundError("Il candidato non esiste.");
      await store.transaction(async (repos) => {
        await repos.candidates.upsertPreferences(id, input);
        await afterProfileChange(repos, id, "preferences", changedFields(aggregate.preferences, input));
      });
    },

    async saveItem<K extends CandidateCollectionKind>(
      candidateId: EntityId,
      kind: K,
      itemId: EntityId | null,
      input: CandidateCollectionInput<K>,
    ): Promise<void> {
      assertCan(actor, "candidate.edit");
      await requireCandidate(candidateId);
      await store.transaction(async (repos) => {
        if (itemId) {
          const updated = await repos.candidates.updateItem(candidateId, kind, itemId, input);
          if (!updated) throw new NotFoundError(`Elemento (${COLLECTION_LABELS[kind]}) non trovato.`);
        } else {
          await repos.candidates.addItem(candidateId, kind, input);
        }
        await afterProfileChange(repos, candidateId, kind, [], itemId ? "UPDATE" : "CREATE");
      });
    },

    async removeItem(candidateId: EntityId, kind: CandidateCollectionKind, itemId: EntityId): Promise<void> {
      assertCan(actor, "candidate.edit");
      await store.transaction(async (repos) => {
        const removed = await repos.candidates.removeItem(candidateId, kind, itemId);
        if (!removed) throw new NotFoundError(`Elemento (${COLLECTION_LABELS[kind]}) non trovato.`);
        await afterProfileChange(repos, candidateId, kind, [], "DELETE");
      });
    },

    async setSkill(candidateId: EntityId, input: CandidateSkillInput): Promise<void> {
      assertCan(actor, "candidate.edit");
      await requireCandidate(candidateId);
      await store.transaction(async (repos) => {
        await repos.candidates.setSkill(candidateId, input);
        await afterProfileChange(repos, candidateId, "skills", [input.skillName]);
      });
    },

    async removeSkill(candidateId: EntityId, skillId: EntityId): Promise<void> {
      assertCan(actor, "candidate.edit");
      await store.transaction(async (repos) => {
        const removed = await repos.candidates.removeSkill(candidateId, skillId);
        if (!removed) throw new NotFoundError("Competenza non trovata.");
        await afterProfileChange(repos, candidateId, "skills", [], "DELETE");
      });
    },

    /** Registra un contatto (telefonata, email…): alimenta "ultimo contatto". */
    async logContact(
      candidateId: EntityId,
      input: { action: ContactAction; note: string | null; applicationId: EntityId | null },
    ): Promise<void> {
      assertCan(actor, "candidate.edit");
      await requireCandidate(candidateId);
      let selectionId: EntityId | null = null;
      let companyId: EntityId | null = null;
      if (input.applicationId) {
        const view = await store.applications.getView(input.applicationId);
        if (!view || view.candidate.id !== candidateId) throw new NotFoundError("Candidatura non trovata.");
        selectionId = view.selection.id;
        companyId = view.company.id;
      }
      await store.transaction(async (repos) => {
        await recordEvent(repos, actor, {
          activity: {
            entityType: input.applicationId ? "APPLICATION" : "CANDIDATE",
            entityId: input.applicationId ?? candidateId,
            action: input.action,
            candidateId,
            selectionId,
            companyId,
            metadata: input.note ? { note: input.note } : {},
          },
        });
        if (input.applicationId) await repos.applications.touch(input.applicationId);
      });
    },

    lookup(text: string) {
      assertCan(actor, "candidate.read");
      return store.candidates.lookup(text, 10);
    },

    listSkills() {
      assertCan(actor, "candidate.read");
      return store.skills.list();
    },
  };
}

export type CandidateService = ReturnType<typeof createCandidateService>;
