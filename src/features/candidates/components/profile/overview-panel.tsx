import { CalendarClock, FileText, Route, UserRound } from "lucide-react";
import Link from "next/link";

import { DetailField, DetailList, DetailSection } from "@/components/common/detail-section";
import { ACTIVE_POLICY_PROGRAM_LABELS, CANDIDATE_ORIGIN_LABELS, INTERVIEW_TYPE_LABELS } from "@/config/labels";
import type { DocumentMetadata, DocumentType } from "@/domain";
import { formatDate, formatLongDate, formatTime } from "@/lib/format";
import type { CandidateProfileView } from "@/services/candidate-service";

import { CollectionEditor } from "../collection-editor";
import { OriginBadge } from "../origin-badge";
import { EditRecruiterButton, EditTrackingButton } from "../section-forms";
import { SkillsEditor } from "../skills-editor";
import { PersonalDetailsPanel } from "./details-panels";

const VIEWABLE = new Set(["application/pdf", "image/jpeg", "image/png"]);

/** Per i documenti importati la data di caricamento non coincide con quella del documento. */
function DocumentLinks({ documents, type }: { documents: DocumentMetadata[]; type: DocumentType }) {
  const matching = documents
    .filter((document) => document.type === type)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (matching.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {matching.map((document, index) => {
        const viewable = VIEWABLE.has(document.mimeType);
        return (
          <a
            key={document.id}
            href={`/api/documents/${document.id}${viewable ? "?view=1" : ""}`}
            {...(viewable ? { target: "_blank", rel: "noopener" } : {})}
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            title={document.filename}
          >
            <FileText aria-hidden="true" className="size-3.5" />
            {viewable ? "Apri" : "Scarica"}
            {matching.length > 1 && ` (${index + 1})`}
          </a>
        );
      })}
    </span>
  );
}

/** Profilo completo e modificabile in Panoramica; riepilogo operativo nella colonna laterale. */
export function OverviewPanel({
  profile,
  canEdit,
  recruiters,
}: {
  profile: CandidateProfileView;
  canEdit: boolean;
  recruiters: Array<{ id: string; displayName: string }>;
}) {
  const { candidate } = profile;
  const next =
    profile.nextInterview?.interview.status === "SCHEDULED" && !profile.nextInterviewOverdue
      ? profile.nextInterview
      : null;
  const hasEvaluationDocuments = profile.documents.some((document) => document.type === "INTERVIEW_EVALUATION");
  const hasCertificates = profile.documents.some((document) => document.type === "CERTIFICATION");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        {next && (
          <DetailSection title="Colloquio programmato" icon={CalendarClock} className="border-primary/25">
            <DetailList>
              <DetailField label="Data colloquio" emphasis>
                <span className="first-letter:uppercase">{formatLongDate(next.interview.scheduledAt)}</span>
              </DetailField>
              <DetailField label="Ora colloquio" emphasis>
                <span className="tabular-nums">{formatTime(next.interview.scheduledAt)}</span>
              </DetailField>
              <DetailField label="Tipo">{INTERVIEW_TYPE_LABELS[next.interview.type]}</DetailField>
              <DetailField label="Recruiter">{next.recruiter?.displayName}</DetailField>
              <DetailField label="Selezione" className="sm:col-span-2">
                <Link
                  href={`/companies/${next.company.id}/selections/${next.selection.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {next.selection.title}
                </Link>{" "}
                <span className="text-muted-foreground">· {next.company.name}</span>
              </DetailField>
              {(next.interview.location || next.interview.meetingUrl) && (
                <DetailField label="Luogo" className="sm:col-span-2">
                  {next.interview.location ?? next.interview.meetingUrl}
                </DetailField>
              )}
            </DetailList>
          </DetailSection>
        )}

        <PersonalDetailsPanel profile={profile} canEdit={canEdit} />
        <CollectionEditor candidateId={candidate.id} kind="experiences" items={profile.experiences} canEdit={canEdit} />
        <SkillsEditor candidateId={candidate.id} skills={profile.skills} canEdit={canEdit} />
        <div className="grid gap-6 xl:grid-cols-2">
          <CollectionEditor candidateId={candidate.id} kind="languages" items={profile.languages} canEdit={canEdit} />
          <CollectionEditor
            candidateId={candidate.id}
            kind="drivingLicenses"
            items={profile.drivingLicenses}
            canEdit={canEdit}
          />
        </div>
        <div className="space-y-3">
          <CollectionEditor
            candidateId={candidate.id}
            kind="certifications"
            items={profile.certifications}
            canEdit={canEdit}
          />
          {hasCertificates && (
            <div className="px-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Certificazioni allegate</p>
              <DocumentLinks documents={profile.documents} type="CERTIFICATION" />
            </div>
          )}
        </div>
      </div>

      <aside className="min-w-0 space-y-6" aria-label="Riepilogo">
        <DetailSection
          title="Riepilogo"
          icon={UserRound}
          action={canEdit ? <EditRecruiterButton candidate={candidate} recruiters={recruiters} /> : undefined}
        >
          <dl className="grid gap-4">
            <DetailField label="Recruiter di riferimento">{profile.primaryRecruiter?.displayName}</DetailField>
            <DetailField label="Schede di valutazione colloquio">
              {hasEvaluationDocuments ? (
                <DocumentLinks documents={profile.documents} type="INTERVIEW_EVALUATION" />
              ) : (
                "Nessuna scheda allegata"
              )}
            </DetailField>
            <DetailField label="Candidature attive">
              {String(
                profile.applications.filter((view) => !view.stage.isTerminal && view.application.closedAt === null)
                  .length,
              )}
            </DetailField>
          </dl>
        </DetailSection>

        <DetailSection
          title="Percorso e politiche attive"
          icon={Route}
          action={canEdit ? <EditTrackingButton candidate={candidate} /> : undefined}
        >
          <dl className="grid gap-4">
            <DetailField label="Origine">
              <span className="inline-flex items-center gap-2">
                <OriginBadge origin={candidate.origin} className="size-6" />
                {CANDIDATE_ORIGIN_LABELS[candidate.origin]}
              </span>
            </DetailField>
            <DetailField label="Orientamento">
              {candidate.orientationCompletedOn ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Completato il {formatDate(candidate.orientationCompletedOn)}
                </span>
              ) : (
                "Non completato"
              )}
              <DocumentLinks documents={profile.documents} type="ORIENTATION" />
            </DetailField>
            <DetailField label="Bilancio delle competenze">
              {profile.documents.some((document) => document.type === "SKILLS_ASSESSMENT") ? (
                <DocumentLinks documents={profile.documents} type="SKILLS_ASSESSMENT" />
              ) : (
                "Non presente"
              )}
            </DetailField>
            {candidate.trackingNotes && (
              <DetailField label="Note sul percorso">
                <span className="whitespace-pre-line">{candidate.trackingNotes}</span>
              </DetailField>
            )}
            <DetailField label="Politiche attive sottoscritte">
              {profile.activePolicies.length > 0
                ? profile.activePolicies
                    .map((policy) => `${ACTIVE_POLICY_PROGRAM_LABELS[policy.programType]} ${policy.referenceYear}`)
                    .join(", ")
                : "Nessuna"}
            </DetailField>
            {(candidate.origin !== "ADV_CORE" || candidate.activatablePolicies.length > 0) && (
              <DetailField label="Politiche attivabili">
                {candidate.activatablePolicies.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {candidate.activatablePolicies.map((program) => (
                      <span key={program} className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                        {ACTIVE_POLICY_PROGRAM_LABELS[program]}
                      </span>
                    ))}
                  </span>
                )}
              </DetailField>
            )}
          </dl>
        </DetailSection>
      </aside>
    </div>
  );
}
