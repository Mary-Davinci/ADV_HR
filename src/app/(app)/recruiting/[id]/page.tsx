import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ButtonLink } from "@/components/common/button-link";
import { Timeline } from "@/components/common/timeline";
import { UrlTabs } from "@/components/common/url-tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LogContactButton } from "@/features/candidates/components/log-contact-button";
import { ApplicationsPanel } from "@/features/candidates/components/profile/applications-panel";
import { CandidateAlerts, CandidateSummary } from "@/features/candidates/components/profile/candidate-summary";
import { OverviewPanel } from "@/features/candidates/components/profile/overview-panel";
import {
  RecommendedSelections,
  RecommendedSelectionsSkeleton,
} from "@/features/candidates/components/profile/recommended-selections";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import { AddToSelectionButton } from "@/features/recruiting/components/add-application-buttons";
import { FEATURES } from "@/config/features";
import { PoolMembership } from "@/features/talent-pools/components/pool-membership";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getServices } from "@/lib/server/services";
import { cn } from "@/lib/utils";
import { uuidSchema } from "@/lib/zod-helpers";
import { getCareers } from "@/lib/server/careers";

/** Stesso carattere con grazie del login: nome del candidato e titoli delle sezioni. */
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });

/** Tema avorio e oro solo in questa pagina; in modalità scura restano i colori del gestionale. */
const IVORY_THEME = [
  "[&_[data-slot=card]]:border-[#e3d4b2] [&_[data-slot=card]]:bg-[#fffdf8]",
  "dark:[&_[data-slot=card]]:border-border dark:[&_[data-slot=card]]:bg-card",
  "[&_[data-slot=card-header]_h2]:font-(family-name:--font-display) [&_[data-slot=card-header]_h2]:text-xl [&_[data-slot=card-header]_h2]:font-semibold",
].join(" ");

async function loadProfile(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  const services = await getServices();
  const target = await services.candidates.mergedInto(id);
  if (target) redirect(`/recruiting/${target}`);
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
  const activeTab =
    typeof tab === "string"
      ? tab === "interviews"
        ? "applications"
        : ["profile", "experience", "skills", "education", "preferences"].includes(tab)
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
      content: <OverviewPanel profile={profile} canEdit={canEdit} />,
    },
    {
      value: "applications",
      label: "Candidature",
      count: profile.applications.length,
      content: (
        <div className="space-y-6">
          <ApplicationsPanel
            profile={profile}
            stages={stages}
            recruiters={recruiters}
            permissions={permissions}
            currentUserId={user.id}
          />
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
    <div className={cn(display.variable, IVORY_THEME, "space-y-6")}>
      <ButtonLink variant="ghost" size="sm" className="-ml-2 text-muted-foreground" href="/recruiting">
        <ArrowLeft aria-hidden="true" />
        Torna ai candidati
      </ButtonLink>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <CandidateSummary
          profile={profile}
          canEdit={canEdit}
          recruiters={recruiters}
          actions={
            <>
              {permissions.manage && (
                <AddToSelectionButton
                  variant="default"
                  candidateId={id}
                  selections={selectionOptions}
                  recruiters={recruiters}
                  excludeSelectionIds={profile.applications.map((view) => view.selection.id)}
                />
              )}
              {canEdit && (
                <LogContactButton
                  candidateId={id}
                  applications={profile.applications
                    .filter((view) => !view.stage.isTerminal)
                    .map((view) => ({
                      id: view.application.id,
                      label: `${view.selection.title} — ${view.company.name}`,
                    }))}
                />
              )}
              {canEdit && (
                <ButtonLink variant="outline" href={`/recruiting/${id}?tab=overview#section-dati-personali`}>
                  <Pencil aria-hidden="true" />
                  Modifica dati
                </ButtonLink>
              )}
            </>
          }
        />

        <div className="min-w-0 space-y-4">
          <CandidateAlerts profile={profile} />
          <UrlTabs key={activeTab} label="Sezioni della scheda candidato" tabs={tabs} defaultValue={activeTab} />
        </div>
      </div>
    </div>
  );
}
