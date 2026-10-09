import type { AuditInfo, EntityId, UserRef } from "./shared";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task extends AuditInfo {
  id: EntityId;
  title: string;
  description: string | null;
  assignedTo: UserRef;
  createdBy: EntityId | null;
  candidateId: EntityId | null;
  applicationId: EntityId | null;
  selectionId: EntityId | null;
  dueAt: Date | null;
  completedAt: Date | null;
  priority: TaskPriority;
  status: TaskStatus;
}

export function isTaskOpen(task: Pick<Task, "status">): boolean {
  return task.status === "OPEN" || task.status === "IN_PROGRESS";
}

export function isTaskOverdue(task: Pick<Task, "status" | "dueAt">, now: Date = new Date()): boolean {
  return isTaskOpen(task) && task.dueAt !== null && task.dueAt.getTime() < now.getTime();
}
