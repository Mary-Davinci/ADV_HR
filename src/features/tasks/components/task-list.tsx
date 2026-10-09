"use client";

import { isPast } from "date-fns";
import { CheckCircle2, Circle, CircleDot, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { TASK_STATUS_LABELS } from "@/config/labels";
import { isTaskOpen, type TaskStatus } from "@/domain";
import { TaskPriorityBadge } from "@/features/recruiting/components/badges";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskView } from "@/repositories/types";

import { setTaskStatusAction } from "../server/actions";

function StatusToggle({ task, disabled }: { task: TaskView; disabled: boolean }) {
  const mutation = useActionMutation(setTaskStatusAction, {
    successMessage: (_: void) => "Task aggiornato",
  });
  const next: TaskStatus = task.status === "DONE" ? "OPEN" : "DONE";
  const Icon = task.status === "DONE" ? CheckCircle2 : task.status === "IN_PROGRESS" ? CircleDot : Circle;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={disabled || mutation.isPending}
      aria-label={task.status === "DONE" ? `Riapri il task: ${task.title}` : `Segna come completato: ${task.title}`}
      onClick={() => mutation.mutate({ taskId: task.id, status: next })}
      className={cn(task.status === "DONE" && "text-primary")}
    >
      {mutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Icon aria-hidden="true" />}
    </Button>
  );
}

/** Elenco task con completamento rapido. Scadenze superate evidenziate con testo, non solo colore. */
export function TaskList({
  tasks,
  canManage,
  compact = false,
  emptyText = "Nessun task.",
}: {
  tasks: TaskView[];
  canManage: boolean;
  compact?: boolean;
  emptyText?: string;
}) {
  if (tasks.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="divide-y">
      {tasks.map((task) => {
        const overdue = isTaskOpen(task) && task.dueAt !== null && isPast(task.dueAt);
        return (
          <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <StatusToggle task={task} disabled={!canManage} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className={cn("text-sm font-medium", task.status === "DONE" && "text-muted-foreground line-through")}>
                {task.title}
              </p>
              {!compact && task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {task.dueAt && (
                  <span className={cn(overdue && "font-medium text-amber-700 dark:text-amber-300")}>
                    {overdue ? "Scaduto: " : "Scadenza: "}
                    {formatRelativeDay(task.dueAt)}
                  </span>
                )}
                {task.candidateId && task.candidateName && (
                  <Link href={`/recruiting/${task.candidateId}`} className="hover:underline">
                    {task.candidateName}
                  </Link>
                )}
                {task.selectionTitle && <span>{task.selectionTitle}</span>}
                {!compact && <span>Assegnato a {task.assignedTo.displayName}</span>}
                {!compact && <span>{TASK_STATUS_LABELS[task.status]}</span>}
              </p>
            </div>
            <TaskPriorityBadge priority={task.priority} />
          </li>
        );
      })}
    </ul>
  );
}
