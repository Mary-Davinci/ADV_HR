import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlarmClock,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  MessageSquareDashed,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/common/button-link";
import { PageHeader } from "@/components/common/page-header";
import { Timeline } from "@/components/common/timeline";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { InterviewList } from "@/features/interviews/components/interview-list";
import { SelectionStatusBadge } from "@/features/recruiting/components/badges";
import { TaskList } from "@/features/tasks/components/task-list";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getServices } from "@/lib/server/services";
import { NEW_CANDIDATE_WINDOW_DAYS } from "@/services/dashboard-service";

export const metadata: Metadata = { title: "Dashboard" };

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function SectionCard({
  id,
  title,
  href,
  linkLabel = "Vedi tutti",
  className,
  children,
}: {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className} role="region" aria-labelledby={id}>
      <CardHeader>
        <h2 id={id} className="text-base leading-snug font-medium">
          {title}
        </h2>
        {href && (
          <CardAction>
            <ButtonLink variant="ghost" size="sm" href={href}>
              {linkLabel}
            </ButtonLink>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requirePermission("candidate.read");
  const services = await getServices();
  const [summary, recruiters] = await Promise.all([services.dashboard.getSummary(), services.users.listRecruiters()]);
  const now = new Date();
  const { kpi } = summary;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${getGreeting(now)}, ${firstName}`}
        description={
          <span className="first-letter:uppercase">
            {format(now, "EEEE d MMMM", { locale: it })} · panoramica della ricerca e selezione
          </span>
        }
        actions={
          <ButtonLink href="/recruiting">
            Cerca candidati
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </ButtonLink>
        }
      />

      <section aria-label="Indicatori principali" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Candidati attivi"
          value={kpi.activeCandidates}
          hint="Con una candidatura in corso"
          icon={Users}
          href="/recruiting"
        />
        <StatCard
          label="Nuovi candidati"
          value={kpi.newCandidates}
          hint={`Inseriti negli ultimi ${NEW_CANDIDATE_WINDOW_DAYS} giorni`}
          icon={UserPlus}
          href="/recruiting?sort=createdAt_desc"
        />
        <StatCard
          label="Colloqui oggi"
          value={kpi.interviewsToday}
          hint="Programmati o svolti oggi"
          icon={CalendarClock}
          href="/interviews?view=today"
        />
        <StatCard
          label="Colloqui questa settimana"
          value={kpi.interviewsThisWeek}
          hint="Da lunedì a domenica"
          icon={CalendarRange}
          href="/calendar?view=week"
        />
        <StatCard
          label="Selezioni aperte"
          value={kpi.openSelections}
          hint="Posizioni in ricerca attiva"
          icon={Briefcase}
          href="/selections?status=OPEN"
        />
        <StatCard
          label="Candidature da revisionare"
          value={kpi.applicationsToReview}
          hint="Nuove o in attesa di valutazione"
          icon={ClipboardList}
          href="/recruiting?stage=PENDING_REVIEW&sort=createdAt_desc"
        />
        <StatCard
          label="Candidati senza feedback"
          value={kpi.candidatesWithoutFeedback}
          hint="Candidature aperte prive di feedback"
          icon={MessageSquareDashed}
          href="/recruiting"
        />
        <StatCard
          label="Task scaduti"
          value={kpi.overdueTasks}
          hint="Da completare oltre la scadenza"
          icon={AlarmClock}
          href="/tasks?filter=overdue"
          tone={kpi.overdueTasks > 0 ? "warning" : undefined}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard id="upcoming-heading" title="Prossimi colloqui" href="/interviews" className="lg:col-span-3">
          <InterviewList
            items={summary.upcomingInterviews}
            recruiters={recruiters}
            canManage={false}
            emptyText="Nessun colloquio in programma."
          />
        </SectionCard>
        <SectionCard id="activity-heading" title="Ultime attività" className="lg:col-span-2">
          <Timeline activities={summary.recentActivities} emptyText="Nessuna attività recente." />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {can(user, "task.read") && (
          <SectionCard id="tasks-heading" title="I miei task" href="/tasks">
            <TaskList
              tasks={summary.myTasks}
              canManage={can(user, "task.manage")}
              compact
              emptyText="Nessun task aperto."
            />
          </SectionCard>
        )}
        <SectionCard id="selections-heading" title="Selezioni attive" href="/selections">
          {summary.activeSelections.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nessuna selezione attiva.</p>
          ) : (
            <ul className="divide-y">
              {summary.activeSelections.map(({ selection, companyName, stats }) => (
                <li key={selection.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      href={`/companies/${selection.companyId}/selections/${selection.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {selection.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {companyName} · {stats.applications} candidati · {stats.toEvaluate} da valutare
                    </p>
                  </div>
                  <SelectionStatusBadge status={selection.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
