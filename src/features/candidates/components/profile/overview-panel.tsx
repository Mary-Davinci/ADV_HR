import { CalendarClock, Route } from "lucide-react";
import Link from "next/link";

import { DetailField, DetailList, DetailSection } from "@/components/common/detail-section";
import { ACTIVE_POLICY_PROGRAM_LABELS, CANDIDATE_ORIGIN_LABELS, INTERVIEW_TYPE_LABELS } from "@/config/labels";
import { formatDate, formatLongDate, formatTime } from "@/lib/format";
import type { CandidateProfileView } from "@/services/candidate-service";

import { CollectionEditor } from "../collection-editor";
import { OriginBadge } from "../origin-badge";
import { EditTrackingButton } from "../section-forms";
import { SkillsEditor } from "../skills-editor";
import { PersonalDetailsPanel } from "./details-panels";
import { DocumentLinks } from "./document-links";

/** Profilo completo e modificabile; la sintesi a colpo d'occhio è nella colonna a sinistra della pagina. */
export function OverviewPanel({ profile, canEdit }: { profile: CandidateProfileView; canEdit: boolean }) {
  const { candidate } = profile;
  const next =
    profile.nextInterview?.interview.status === "SCHEDULED" && !profile.nextInterviewOverdue
      ? profile.nextInterview
      : null;
  const hasCertificates = profile.documents.some((document) => document.type === "CERTIFICATION");

  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0 space-y-6">
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
        {(profile.languages.length > 0 || profile.drivingLicenses.length > 0) && (
          <div className="grid gap-6 xl:grid-cols-2">
            {profile.languages.length > 0 && (
              <CollectionEditor
                candidateId={candidate.id}
                kind="languages"
                items={profile.languages}
                canEdit={canEdit}
              />
            )}
            {profile.drivingLicenses.length > 0 && (
              <CollectionEditor
                candidateId={candidate.id}
                kind="drivingLicenses"
                items={profile.drivingLicenses}
                canEdit={canEdit}
              />
            )}
          </div>
        )}
        {(profile.certifications.length > 0 || hasCertificates) && (
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
        )}
      </div>

      <div className="min-w-0">
        <DetailSection
          title="Percorso e politiche attive"
          icon={Route}
          action={canEdit ? <EditTrackingButton candidate={candidate} /> : undefined}
        >
          <DetailList>
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
            {candidate.activatablePolicies.length > 0 && (
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
          </DetailList>
        </DetailSection>
      </div>
    </div>
  );
}
