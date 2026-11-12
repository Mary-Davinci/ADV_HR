import { DomainRuleError, type EntityId, type Task, type TaskStatus } from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type { Repositories, TaskInput, TaskQuery } from "@/repositories/types";

import { NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";

export function createTaskService(context: ServiceContext) {
  const { store, actor } = context;

  async function validate(input: TaskInput) {
    if (!(await store.users.listActive()).some((user) => user.id === input.assignedTo))
      throw new DomainRuleError("Seleziona un utente attivo.", "INVALID_ASSIGNEE");
    if (input.candidateId && !(await store.candidates.getById(input.candidateId)))
      throw new NotFoundError("Candidato non trovato.");
    if (input.selectionId && !(await store.selections.getById(input.selectionId)))
      throw new NotFoundError("Selezione non trovata.");
    if (input.applicationId) {
      const application = await store.applications.getById(input.applicationId);
      if (
        !application ||
        (input.candidateId && application.candidateId !== input.candidateId) ||
        (input.selectionId && application.selectionId !== input.selectionId)
      )
        throw new DomainRuleError("La candidatura non corrisponde al candidato o alla selezione.", "INVALID_TASK_LINK");
    }
  }

  async function notify(repos: Repositories, task: Task) {
    await repos.notifications.createForUsers([task.assignedTo.id], {
      kind: "TASK_ASSIGNED",
      title: "Task assegnato",
      body: task.title,
      href: `/tasks?filter=mine&task=${task.id}`,
      candidateId: task.candidateId,
      sourceKey: `task-assigned:${task.id}:${task.updatedAt.toISOString()}`,
    });
  }

  return {
    list(query: TaskQuery) {
      assertCan(actor, "task.read");
      return store.tasks.list(query);
    },

    async create(input: TaskInput): Promise<{ id: EntityId }> {
      assertCan(actor, "task.manage");
      await validate(input);
      return store.transaction(async (repos) => {
        const task = await repos.tasks.create({ ...input, createdBy: actor.id });
        await notify(repos, task);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "TASK",
            entityId: task.id,
            action: "TASK_CREATED",
            candidateId: input.candidateId,
            selectionId: input.selectionId,
            metadata: { title: input.title, assignedTo: input.assignedTo },
          },
          audit: { entityType: "TASK", entityId: task.id, action: "CREATE" },
        });
        return { id: task.id };
      });
    },

    async update(id: EntityId, input: TaskInput): Promise<void> {
      assertCan(actor, "task.manage");
      await validate(input);
      await store.transaction(async (repos) => {
        const before = await repos.tasks.getById(id);
        if (!before) throw new NotFoundError("Task non trovato.");
        const task = await repos.tasks.update(id, input);
        if (!task) throw new NotFoundError("Task non trovato.");
        if (before.assignedTo.id !== input.assignedTo) await notify(repos, task);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "TASK",
            entityId: id,
            action: "UPDATED",
            candidateId: task.candidateId,
            selectionId: task.selectionId,
            metadata: { title: task.title },
          },
          audit: {
            entityType: "TASK",
            entityId: id,
            action: "UPDATE",
            changes: { fields: Object.keys(input), reassigned: before.assignedTo.id !== input.assignedTo },
          },
        });
      });
    },

    async remove(id: EntityId): Promise<void> {
      assertCan(actor, "task.manage");
      await store.transaction(async (repos) => {
        if (!(await repos.tasks.delete(id))) throw new NotFoundError("Task non trovato.");
        await recordEvent(repos, actor, { audit: { entityType: "TASK", entityId: id, action: "DELETE" } });
      });
    },

    async setStatus(id: EntityId, status: TaskStatus): Promise<void> {
      assertCan(actor, "task.manage");
      const task = await store.tasks.getById(id);
      if (!task) throw new NotFoundError("Task non trovato.");
      if (task.status === status) return;
      await store.transaction(async (repos) => {
        await repos.tasks.updateStatus(id, status, status === "DONE" ? nowOf(context) : null);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "TASK",
            entityId: id,
            action: status === "DONE" ? "TASK_COMPLETED" : "STATUS_CHANGED",
            candidateId: task.candidateId,
            selectionId: task.selectionId,
            metadata: { from: task.status, to: status, title: task.title },
          },
          audit: { entityType: "TASK", entityId: id, action: "UPDATE", changes: { from: task.status, to: status } },
        });
      });
    },
  };
}

export function createTalentPoolService(context: ServiceContext) {
  const { store, actor } = context;

  return {
    list() {
      assertCan(actor, "talentPool.read");
      return store.talentPools.list();
    },

    async getDetail(id: EntityId) {
      assertCan(actor, "talentPool.read");
      const pool = await store.talentPools.getById(id);
      if (!pool) return null;
      return { pool, members: await store.talentPools.members(id) };
    },

    async create(input: { name: string; description: string | null }): Promise<{ id: EntityId }> {
      assertCan(actor, "talentPool.manage");
      return store.transaction(async (repos) => {
        const pool = await repos.talentPools.create({ ...input, createdBy: actor.id });
        await recordEvent(repos, actor, {
          activity: { entityType: "TALENT_POOL", entityId: pool.id, action: "CREATED", metadata: { name: pool.name } },
          audit: { entityType: "TALENT_POOL", entityId: pool.id, action: "CREATE" },
        });
        return { id: pool.id };
      });
    },

    async addMember(poolId: EntityId, candidateId: EntityId): Promise<boolean> {
      assertCan(actor, "talentPool.manage");
      const [pool, candidate] = await Promise.all([
        store.talentPools.getById(poolId),
        store.candidates.getById(candidateId),
      ]);
      if (!pool || !candidate) throw new NotFoundError("Talent pool o candidato non trovato.");
      return store.transaction(async (repos) => {
        const added = await repos.talentPools.addMember(poolId, candidateId, actor.id);
        if (added) {
          await recordEvent(repos, actor, {
            activity: {
              entityType: "TALENT_POOL",
              entityId: poolId,
              action: "ADDED_TO_POOL",
              candidateId,
              metadata: { pool: pool.name },
            },
            audit: { entityType: "TALENT_POOL", entityId: poolId, action: "UPDATE", changes: { added: candidateId } },
          });
        }
        return added;
      });
    },

    async removeMember(poolId: EntityId, candidateId: EntityId): Promise<void> {
      assertCan(actor, "talentPool.manage");
      const pool = await store.talentPools.getById(poolId);
      if (!pool) throw new NotFoundError("Talent pool non trovato.");
      await store.transaction(async (repos) => {
        const removed = await repos.talentPools.removeMember(poolId, candidateId);
        if (!removed) return;
        await recordEvent(repos, actor, {
          activity: {
            entityType: "TALENT_POOL",
            entityId: poolId,
            action: "REMOVED_FROM_POOL",
            candidateId,
            metadata: { pool: pool.name },
          },
          audit: { entityType: "TALENT_POOL", entityId: poolId, action: "UPDATE", changes: { removed: candidateId } },
        });
      });
    },
  };
}
