import type { EntityId } from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type {
  CompanyInput,
  CompanyQuery,
  JobDescriptionInput,
  SelectionInput,
  SelectionQuery,
} from "@/repositories/types";

import { changedFields, NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";

export function createCompanyService(context: ServiceContext) {
  const { store, actor } = context;

  return {
    list(query: CompanyQuery) {
      assertCan(actor, "company.read");
      return store.companies.list(query);
    },

    async getDetail(id: EntityId) {
      assertCan(actor, "company.read");
      const company = await store.companies.getById(id);
      if (!company) return null;
      const [selections, documents, timeline] = await Promise.all([
        store.selections.list({ companyId: id, limit: 100 }),
        store.documents.list({ companyId: id }),
        store.activities.list({ companyId: id, limit: 50 }),
      ]);
      return { company, selections: selections.items, documents, timeline };
    },

    options() {
      assertCan(actor, "company.read");
      return store.companies.options();
    },

    async create(input: CompanyInput): Promise<{ id: EntityId }> {
      assertCan(actor, "company.manage");
      return store.transaction(async (repos) => {
        const company = await repos.companies.create(input);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "COMPANY",
            entityId: company.id,
            action: "CREATED",
            companyId: company.id,
            metadata: {},
          },
          audit: { entityType: "COMPANY", entityId: company.id, action: "CREATE" },
        });
        return { id: company.id };
      });
    },

    async update(id: EntityId, input: CompanyInput): Promise<void> {
      assertCan(actor, "company.manage");
      const before = await store.companies.getById(id);
      if (!before) throw new NotFoundError("L'azienda non esiste.");
      await store.transaction(async (repos) => {
        await repos.companies.update(id, input);
        const fields = changedFields(before, input);
        await recordEvent(repos, actor, {
          activity: { entityType: "COMPANY", entityId: id, action: "UPDATED", companyId: id, metadata: { fields } },
          audit: { entityType: "COMPANY", entityId: id, action: "UPDATE", changes: { fields } },
        });
      });
    },
  };
}

export function createSelectionService(context: ServiceContext) {
  const { store, actor } = context;

  return {
    list(query: SelectionQuery) {
      assertCan(actor, "selection.read");
      return store.selections.list(query);
    },

    options() {
      assertCan(actor, "selection.read");
      return store.selections.options({ statuses: ["DRAFT", "OPEN", "PAUSED"] });
    },

    async getDetail(id: EntityId) {
      assertCan(actor, "selection.read");
      const selection = await store.selections.getById(id);
      if (!selection) return null;
      const [jobDescription, applications, documents, timeline, stages, interviews] = await Promise.all([
        store.jobDescriptions.getBySelection(id),
        store.applications.list({ selectionId: id }),
        store.documents.list({ selectionId: id }),
        store.activities.list({ selectionId: id, limit: 50 }),
        store.stages.list(),
        store.interviews.list({ selectionId: id, statuses: ["SCHEDULED"], from: nowOf(context) }),
      ]);
      return {
        ...selection,
        jobDescription,
        applications,
        documents,
        timeline,
        stages,
        upcomingInterviews: interviews.items,
      };
    },

    async create(input: SelectionInput): Promise<{ id: EntityId }> {
      assertCan(actor, "selection.manage");
      const company = await store.companies.getById(input.companyId);
      if (!company) throw new NotFoundError("L'azienda non esiste.");
      const now = nowOf(context);
      const values: SelectionInput = {
        ...input,
        openedAt: input.openedAt ?? (input.status === "OPEN" ? now : null),
        closedAt: input.closedAt ?? (["CLOSED", "ARCHIVED"].includes(input.status) ? now : null),
      };
      return store.transaction(async (repos) => {
        const selection = await repos.selections.create({ ...values, createdBy: actor.id });
        await repos.jobDescriptions.upsert(selection.id, emptyJobDescription(selection.title));
        await recordEvent(repos, actor, {
          activity: {
            entityType: "SELECTION",
            entityId: selection.id,
            action: "CREATED",
            selectionId: selection.id,
            companyId: input.companyId,
            metadata: { title: selection.title },
          },
          audit: { entityType: "SELECTION", entityId: selection.id, action: "CREATE" },
        });
        return { id: selection.id };
      });
    },

    async update(id: EntityId, input: SelectionInput): Promise<void> {
      assertCan(actor, "selection.manage");
      const before = await store.selections.getById(id);
      if (!before) throw new NotFoundError("La selezione non esiste.");
      const now = nowOf(context);
      const values: SelectionInput = {
        ...input,
        companyId: before.selection.companyId,
        openedAt: input.openedAt ?? before.selection.openedAt ?? (input.status === "OPEN" ? now : null),
        closedAt: ["CLOSED", "ARCHIVED"].includes(input.status)
          ? (input.closedAt ?? before.selection.closedAt ?? now)
          : null,
      };
      await store.transaction(async (repos) => {
        await repos.selections.update(id, values);
        const statusChanged = before.selection.status !== input.status;
        await recordEvent(repos, actor, {
          activity: {
            entityType: "SELECTION",
            entityId: id,
            action: statusChanged ? "STATUS_CHANGED" : "UPDATED",
            selectionId: id,
            companyId: before.selection.companyId,
            metadata: statusChanged ? { from: before.selection.status, to: input.status } : {},
          },
          audit: {
            entityType: "SELECTION",
            entityId: id,
            action: "UPDATE",
            changes: { fields: changedFields(before.selection, values), status: input.status },
          },
        });
      });
    },

    async saveJobDescription(selectionId: EntityId, input: JobDescriptionInput): Promise<void> {
      assertCan(actor, "selection.manage");
      const selection = await store.selections.getById(selectionId);
      if (!selection) throw new NotFoundError("La selezione non esiste.");
      await store.transaction(async (repos) => {
        await repos.jobDescriptions.upsert(selectionId, input);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "SELECTION",
            entityId: selectionId,
            action: "UPDATED",
            selectionId,
            companyId: selection.selection.companyId,
            metadata: { section: "jobDescription" },
          },
          audit: {
            entityType: "SELECTION",
            entityId: selectionId,
            action: "UPDATE",
            changes: { section: "jobDescription" },
          },
        });
      });
    },
  };
}

function emptyJobDescription(title: string): JobDescriptionInput {
  return {
    title,
    summary: null,
    duties: null,
    requirements: null,
    employmentType: null,
    workTime: null,
    workMode: null,
    salaryMin: null,
    salaryMax: null,
    currency: "EUR",
    workingHours: null,
    locationCity: null,
    locationProvince: null,
    locationRegion: null,
    notes: null,
  };
}
