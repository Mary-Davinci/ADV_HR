import { ArrowLeft, CalendarClock, CircleCheck, CircleHelp, CircleX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";
import { Timeline } from "@/components/common/timeline";
import { UrlTabs } from "@/components/common/url-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { SelectionFormButton } from "@/features/companies/components/company-forms";
import { JobDescriptionCard } from "@/features/companies/components/job-description";
import { PipelineTable } from "@/features/companies/components/pipeline-table";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import { InterviewList } from "@/features/interviews/components/interview-list";
import { AddCandidateToSelectionButton } from "@/features/recruiting/components/add-application-buttons";
import { SelectionStatusBadge } from "@/features/recruiting/components/badges";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { EMPTY_VALUE, formatDate } from "@/lib/format";
import { getServices } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";

type Params = PageProps<"/companies/[id]/selections/[selectionId]">;

async function load(companyId: string, selectionId: string) {
  if (!uuidSchema.safeParse(selectionId).success || !uuidSchema.safeParse(companyId).success) return null;
  const detail = await (await getServices()).selections.getDetail(selectionId);
  return detail && detail.selection.companyId === companyId ? detail : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, selectionId } = await params;
  const detail = await load(id, selectionId);
  return { title: detail ? `${detail.selection.title} · ${detail.companyName}` : "Selezione non trovata" };
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function SelectionPage({ params, searchParams }: Params) {
  const user = await requirePermission("selection.read");
  const [{ id, selectionId }, { tab }] = await Promise.all([params, searchParams]);
  const detail = await load(id, selectionId);
  if (!detail) notFound();

  const services = await getServices();
  const recruiters = await services.users.listRecruiters();
  const {
    selection,
    companyName,
    stats,
    jobDescription,
    applications,
    documents,
    timeline,
    stages,
    upcomingInterviews,
  } = detail;
  const permissions = {
    manage: can(user, "application.manage"),
    evaluate: can(user, "evaluation.manage"),
    feedback: can(user, "feedback.manage"),
    interview: can(user, "interview.manage"),
  };
  const selectionClosed = ["CLOSED", "ARCHIVED"].includes(selection.status);

  return (
    <div className="space-y-6">
      <ButtonLink variant="ghost" size="sm" className="-ml-2 text-muted-foreground" href={`/companies/${id}`}>
        <ArrowLeft aria-hidden="true" />
        {companyName}
      </ButtonLink>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{selection.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <SelectionStatusBadge status={selection.status} />
            <Link href={`/companies/${id}`} className="hover:underline">
              {companyName}
            </Link>
            <span>Apertura: {selection.openedAt ? formatDate(selection.openedAt) : EMPTY_VALUE}</span>
            <span>Chiusura: {selection.closedAt ? formatDate(selection.closedAt) : EMPTY_VALUE}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, "selection.manage") && <SelectionFormButton selection={selection} />}
          {permissions.manage && !selectionClosed && (
            <AddCandidateToSelectionButton
              selectionId={selection.id}
              recruiters={recruiters}
              existingCandidateIds={applications.map((view) => view.candidate.id)}
            />
          )}
        </div>
      </header>

      <section aria-label="Sintesi selezione" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Candidati" value={stats.applications} icon={Users} />
        <Stat label="Idonei" value={stats.suitable} icon={CircleCheck} />
        <Stat label="Non idonei" value={stats.notSuitable} icon={CircleX} />
        <Stat label="Da valutare" value={stats.toEvaluate} icon={CircleHelp} />
        <Stat label="Colloqui programmati" value={stats.scheduledInterviews} icon={CalendarClock} />
      </section>

      <UrlTabs
        label="Sezioni della selezione"
        defaultValue={typeof tab === "string" ? tab : undefined}
        tabs={[
          {
            value: "pipeline",
            label: "Candidature",
            count: applications.length,
            content:
              applications.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nessun candidato in selezione"
                  description="Aggiungi candidati dalla ricerca o da “Aggiungi candidato”."
                />
              ) : (
                <PipelineTable
                  applications={applications}
                  stages={stages}
                  recruiters={recruiters}
                  interviews={upcomingInterviews}
                  permissions={permissions}
                />
              ),
          },
          {
            value: "job",
            label: "Job description",
            content: (
              <JobDescriptionCard
                selectionId={selection.id}
                selectionTitle={selection.title}
                jobDescription={jobDescription}
                canEdit={can(user, "selection.manage")}
              />
            ),
          },
          {
            value: "interviews",
            label: "Colloqui in programma",
            count: upcomingInterviews.length,
            content: (
              <InterviewList
                items={upcomingInterviews}
                recruiters={recruiters}
                canManage={permissions.interview}
                emptyText="Nessun colloquio in programma."
              />
            ),
          },
          {
            value: "documents",
            label: "Documenti",
            count: documents.length,
            content: (
              <DocumentsPanel
                owner={{ selectionId: selection.id }}
                documents={documents}
                allowedTypes={["JOB_DESCRIPTION", "CONTRACT", "OTHER"]}
                canManage={can(user, "document.manage")}
              />
            ),
          },
          {
            value: "timeline",
            label: "Timeline",
            content: (
              <Card>
                <CardContent>
                  <Timeline activities={timeline} />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
