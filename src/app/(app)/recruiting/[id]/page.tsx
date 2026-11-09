import { ArrowLeft, Clock, History, PhoneCall } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ButtonLink } from "@/components/common/button-link";
import { Timeline } from "@/components/common/timeline";
import { UrlTabs } from "@/components/common/url-tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CollectionEditor } from "@/features/candidates/components/collection-editor";
import { LogContactButton } from "@/features/candidates/components/log-contact-button";
import { ApplicationsPanel } from "@/features/candidates/components/profile/applications-panel";
import { PreferencesPanel } from "@/features/candidates/components/profile/details-panels";
import { OverviewPanel } from "@/features/candidates/components/profile/overview-panel";
import {
  RecommendedSelections,
  RecommendedSelectionsSkeleton,
} from "@/features/candidates/components/profile/recommended-selections";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import { AddToSelectionButton } from "@/features/recruiting/components/add-application-buttons";
import { StageBadge } from "@/features/recruiting/components/badges";
import { FEATURES } from "@/config/features";
import { PoolMembership } from "@/features/talent-pools/components/pool-membership";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime, formatTimeAgo, getInitials } from "@/lib/format";
import { getServices } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";
import { getCareers } from "@/lib/server/careers";

async function loadProfile(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  const services = await getServices();
  return services.candidates.getProfile(id);
}

export async function generateMetadata({ params }: PageProps<"/recruiting/[id]">): Promise<Metadata> {
  const profile = await loadProfile((await params).id);
  return { title: profile ? profile.fullName : "Candidato non trovato" };
}

export default async function CandidatePage({ params, searchParams }: PageProps<"/recruiting/[id]">) {
  const user = await requirePermission("candidate.read");
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const profile = await loadProfile(id);
  if (!profile) notFound();
  const webSubmissions = await getCareers().submissions(user, id);

  const services = await getServices();
  const canEdit = can(user, "candidate.edit");
  const [stages, recruiters, selectionOptions, pools] = await Promise.all([
    services.applications.listStages(),
    services.users.listRecruiters(),
    can(user, "application.manage") ? services.selections.options() : Promise.resolve([]),
    FEATURES.talentPools && can(user, "talentPool.read") ? services.talentPools.list() : Promise.resolve([]),
  ]);
  const permissions = {
    manage: can(user, "application.manage"),
    evaluate: can(user, "evaluation.manage"),
    feedback: can(user, "feedback.manage"),
    interview: can(user, "interview.manage"),
  };
  const latest = profile.applications[0];
  const activeTab =
    typeof tab === "string"
      ? tab === "interviews"
        ? "applications"
        : ["profile", "experience", "skills"].includes(tab)
          ? "overview"
          : tab
      : "overview";

  const tabs = [
    ...(webSubmissions.length
      ? [
          {
            value: "website",
            label: "Dal sito web",
            content: (
              <Card>
                <CardContent className="space-y-5">
                  {webSubmissions.map((submission, index) => (
                    <div key={index} className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Informativa accettata il {formatDateTime(submission.consentedAt)}. Il CV si trova nella scheda
                        Documenti.
                      </p>
                      {submission.possibleDuplicateId && (
                        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                          Esiste già un profilo con questa email.{" "}
                          <ButtonLink variant="link" href={`/recruiting/${submission.possibleDuplicateId}`}>
                            Confronta il profilo esistente
                          </ButtonLink>
                        </p>
                      )}
                      {submission.message && <p className="text-sm whitespace-pre-wrap">{submission.message}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ),
          },
        ]
      : []),
    {
      value: "overview",
      label: "Panoramica",
      content: <OverviewPanel profile={profile} canEdit={canEdit} recruiters={recruiters} />,
    },
    {
      value: "education",
      label: "Formazione e altro",
      count: profile.education.length,
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <CollectionEditor candidateId={id} kind="education" items={profile.education} canEdit={canEdit} />
          </div>
          <CollectionEditor candidateId={id} kind="activePolicies" items={profile.activePolicies} canEdit={canEdit} />
          <CollectionEditor candidateId={id} kind="interests" items={profile.interests} canEdit={canEdit} />
        </div>
      ),
    },
    { value: "preferences", label: "Preferenze", content: <PreferencesPanel profile={profile} canEdit={canEdit} /> },
    {
      value: "applications",
      label: "Candidature",
      count: profile.applications.length,
      content: (
        <div className="space-y-6">
          <ApplicationsPanel profile={profile} stages={stages} recruiters={recruiters} permissions={permissions} />
          <Suspense fallback={<RecommendedSelectionsSkeleton />}>
            <RecommendedSelections candidateId={id} canAdd={permissions.manage} />
          </Suspense>
        </div>
      ),
    },
    {
      value: "documents",
      label: "Documenti",
      count: profile.documents.length,
      content: (
        <DocumentsPanel
          owner={{ candidateId: id }}
          documents={profile.documents}
          allowedTypes={["CV", "COVER_LETTER", "CERTIFICATION", "INTERVIEW_EVALUATION", "IDENTITY_DOCUMENT", "OTHER"]}
          canManage={can(user, "document.manage")}
        />
      ),
    },
    {
      value: "timeline",
      label: "Timeline",
      content: (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className={FEATURES.talentPools ? "lg:col-span-2" : "lg:col-span-3"}>
            <CardHeader>
              <h3 className="text-base font-medium">Attività</h3>
            </CardHeader>
            <CardContent>
              <Timeline activities={profile.timeline} />
            </CardContent>
          </Card>
          {FEATURES.talentPools && (
            <Card>
              <CardHeader>
                <h3 className="text-base font-medium">Talent pool</h3>
              </CardHeader>
              <CardContent>
                <PoolMembership
                  candidateId={id}
                  memberOf={profile.talentPools}
                  pools={pools.map((pool) => ({ id: pool.id, name: pool.name }))}
                  canManage={can(user, "talentPool.manage")}
                />
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ButtonLink variant="ghost" size="sm" className="-ml-2 text-muted-foreground" href="/recruiting">
        <ArrowLeft aria-hidden="true" />
        Torna ai candidati
      </ButtonLink>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="size-12">
            <AvatarFallback className="bg-primary/10 text-base font-medium text-primary">
              {getInitials(profile.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="sr-only">Scheda candidato: </span>
              {profile.candidate.firstName} {profile.candidate.lastName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {latest ? (
                <span className="flex max-w-full min-w-0 items-center gap-2">
                  <StageBadge code={latest.stage.code} label={latest.stage.label} />
                  <span className="max-w-64 min-w-0 truncate">{latest.selection.title}</span>
                </span>
              ) : (
                <span>Nessuna candidatura attiva</span>
              )}
              <span
                className="flex items-center gap-1.5"
                title={profile.lastContactAt ? formatDateTime(profile.lastContactAt) : undefined}
              >
                <PhoneCall aria-hidden="true" className="size-3.5" />
                Ultimo contatto: {profile.lastContactAt ? formatTimeAgo(profile.lastContactAt) : "nessuno"}
              </span>
              <span className="flex items-center gap-1.5">
                <History aria-hidden="true" className="size-3.5" />
                Ultima revisione:{" "}
                {profile.profile.lastReviewedAt ? formatTimeAgo(profile.profile.lastReviewedAt) : "mai"}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock aria-hidden="true" className="size-3.5" />
                Aggiornato {formatTimeAgo(profile.candidate.updatedAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <LogContactButton
              candidateId={id}
              applications={profile.applications
                .filter((view) => !view.stage.isTerminal)
                .map((view) => ({ id: view.application.id, label: `${view.selection.title} — ${view.company.name}` }))}
            />
          )}
          {permissions.manage && (
            <AddToSelectionButton
              candidateId={id}
              selections={selectionOptions}
              recruiters={recruiters}
              excludeSelectionIds={profile.applications.map((view) => view.selection.id)}
            />
          )}
        </div>
      </header>

      <UrlTabs key={activeTab} label="Sezioni della scheda candidato" tabs={tabs} defaultValue={activeTab} />
    </div>
  );
}
