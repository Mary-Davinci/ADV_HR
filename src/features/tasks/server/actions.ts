"use server";

import { runAction } from "@/lib/server/action";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";

import { poolMemberSchema, talentPoolSchema, taskSchema, taskStatusSchema } from "../schemas";

export async function createTaskAction(input: unknown) {
  return runAction(input, { schema: taskSchema, revalidate: "all" }, (values, services) =>
    services.tasks.create(values),
  );
}

export async function updateTaskAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ taskId: uuidSchema, values: taskSchema }), revalidate: "all" },
    async ({ taskId, values }, services) => {
      await services.tasks.update(taskId, values);
      return { id: taskId };
    },
  );
}

export async function removeTaskAction(input: unknown) {
  return runAction(input, { schema: z.object({ taskId: uuidSchema }), revalidate: "all" }, ({ taskId }, services) =>
    services.tasks.remove(taskId),
  );
}

export async function setTaskStatusAction(input: unknown) {
  return runAction(input, { schema: taskStatusSchema, revalidate: "all" }, ({ taskId, status }, services) =>
    services.tasks.setStatus(taskId, status),
  );
}

export async function createTalentPoolAction(input: unknown) {
  return runAction(input, { schema: talentPoolSchema, revalidate: ["/talent-pools"] }, (values, services) =>
    services.talentPools.create(values),
  );
}

export async function addPoolMemberAction(input: unknown) {
  return runAction(input, { schema: poolMemberSchema, revalidate: "all" }, ({ poolId, candidateId }, services) =>
    services.talentPools.addMember(poolId, candidateId),
  );
}

export async function removePoolMemberAction(input: unknown) {
  return runAction(input, { schema: poolMemberSchema, revalidate: "all" }, ({ poolId, candidateId }, services) =>
    services.talentPools.removeMember(poolId, candidateId),
  );
}
