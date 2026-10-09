import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { TaskStatus } from "@/domain";
import { CreateTaskButton } from "@/features/tasks/components/create-task-button";
import { TaskList } from "@/features/tasks/components/task-list";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getServices } from "@/lib/server/services";
import type { TaskQuery } from "@/repositories/types";

export const metadata: Metadata = { title: "Task" };

const FILTERS = {
  mine: "I miei task",
  overdue: "Scaduti",
  team: "Tutto il team",
  done: "Completati",
} as const;
type Filter = keyof typeof FILTERS;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const schema = z.object({
  filter: z.preprocess(first, z.enum(["mine", "overdue", "team", "done"]).optional()).catch(undefined),
});

const OPEN: TaskStatus[] = ["OPEN", "IN_PROGRESS"];

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requirePermission("task.read");
  const filter: Filter = schema.parse(await searchParams).filter ?? "mine";
  const now = new Date();
  const queries: Record<Filter, TaskQuery> = {
    mine: { assignedTo: user.id, statuses: OPEN },
    overdue: { statuses: OPEN, overdueAt: now },
    team: { statuses: OPEN },
    done: { statuses: ["DONE", "CANCELLED"] },
  };
  const services = await getServices();
  const [result, users, selections] = await Promise.all([
    services.tasks.list({ ...queries[filter], limit: 100 }),
    services.users.listActive(),
    services.selections.options(),
  ]);
  const canManage = can(user, "task.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task"
        description="Attività operative del team HR: richiami, verifiche, invii ai clienti."
        actions={
          canManage ? <CreateTaskButton users={users} defaultAssigneeId={user.id} selections={selections} /> : undefined
        }
      />
      <nav aria-label="Filtro task" className="flex flex-wrap gap-1 border-b">
        {(Object.keys(FILTERS) as Filter[]).map((key) => (
          <Link
            key={key}
            href={`/tasks?filter=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              filter === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {FILTERS[key]}
          </Link>
        ))}
      </nav>
      <Card>
        <CardContent>
          <TaskList tasks={result.items} canManage={canManage} emptyText="Nessun task in questo elenco." />
        </CardContent>
      </Card>
    </div>
  );
}
