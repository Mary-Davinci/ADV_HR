import { BriefcaseBusiness, CalendarClock, IdCard, MessageSquareText, Route, UserRound } from "lucide-react";
import Link from "next/link";

import { DetailField, DetailList, DetailSection } from "@/components/common/detail-section";
import {
  ACTIVE_POLICY_PROGRAM_LABELS,
  AVAILABILITY_LABELS,
  CANDIDATE_ORIGIN_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  GENDER_LABELS,
  INTERVIEW_TYPE_LABELS,
  labelOf,
  PROTECTED_CATEGORY_LABELS,
} from "@/config/labels";
import { getTotalExperienceMonths } from "@/domain";
import { formatDate, formatDateTime, formatLongDate, formatMonths, formatTime, getAge } from "@/lib/format";
import type { CandidateProfileView } from "@/services/candidate-service";

import { EditTrackingButton } from "../section-forms";

/**
 * Panoramica. Ordine informativo concordato con HR:
 * nome → data/ora colloquio → CF → nascita → residenza → L.68/99 →
 * esperienza → disponibilità → feedback recruiter. Sezioni verticali.
 */
export function OverviewPanel({ profile, canEdit }: { profile: CandidateProfileView; canEdit: boolean }) {
  const { candidate } = profile;
  const next = profile.nextInterview;
  const age = getAge(candidate.birthDate);
  const residence = [
    profile.profile.residenceCity,
    profile.profile.residenceProvince && `(${profile.profile.residenceProvince})`,
  ]
    .filter(Boolean)
    .join(" ");
  const totalMonths = getTotalExperienceMonths(profile.experiences);
  const latestFeedbacks = profile.feedbacks.slice(0, 3);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <DetailSection title="Colloquio" icon={CalendarClock} className="border-primary/25">
          {profile.nextInterviewOverdue && (
            <p
              role="status"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200"
            >
              Colloquio passato ancora segnato come programmato: aggiornane lo stato dalla tab Colloqui.
            </p>
          )}
          {/* Data e ora restano sempre visibili (priorità HR), anche senza colloquio. */}
          <DetailList>
            <DetailField label="Data colloquio" emphasis>
              {next && <span className="first-letter:uppercase">{formatLongDate(next.interview.scheduledAt)}</span>}
            </DetailField>
            <DetailField label="Ora colloquio" emphasis>
              {next && <span className="tabular-nums">{formatTime(next.interview.scheduledAt)}</span>}
            </DetailField>
          </DetailList>
          {next ? (
            <DetailList className="mt-4">
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
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nessun colloquio in programma.</p>
          )}
        </DetailSection>

        <DetailSection title="Dati personali" icon={IdCard}>
          <DetailList>
            <DetailField label="Codice fiscale">
              {candidate.fiscalCode && <span className="font-mono tracking-wide">{candidate.fiscalCode}</span>}
            </DetailField>
            <DetailField label="Data di nascita">
              {candidate.birthDate && `${formatDate(candidate.birthDate)}${age !== null ? ` (${age} anni)` : ""}`}
            </DetailField>
            <DetailField label="Residenza">{residence}</DetailField>
            <DetailField label="Categoria protetta (L. 68/99)">
              {labelOf(PROTECTED_CATEGORY_LABELS, profile.profile.protectedCategory)}
            </DetailField>
            <DetailField label="Stato occupazionale">
              {labelOf(EMPLOYMENT_STATUS_LABELS, profile.profile.employmentStatus)}
            </DetailField>
            <DetailField label="Genere">{labelOf(GENDER_LABELS, candidate.gender)}</DetailField>
          </DetailList>
        </DetailSection>

        <DetailSection title="Esperienza e disponibilità" icon={BriefcaseBusiness}>
          <DetailList>
            <DetailField label="Esperienza" className="sm:col-span-2">
              {profile.experiences.length > 0 && (
                <span className="block space-y-1">
                  <span className="block font-medium">{formatMonths(totalMonths)} complessivi</span>
                  {profile.experiences.slice(0, 2).map((experience) => (
                    <span key={experience.id} className="block text-muted-foreground">
                      {experience.roleTitle} · {experience.companyName}
                      {experience.currentRole && " (attuale)"}
                    </span>
                  ))}
                </span>
              )}
            </DetailField>
            <DetailField label="Disponibilità">
              {labelOf(AVAILABILITY_LABELS, profile.preferences.availability, "")}
            </DetailField>
            <DetailField label="Note disponibilità">{profile.preferences.availabilityNotes}</DetailField>
          </DetailList>
        </DetailSection>

        <DetailSection title="Feedback recruiter" icon={MessageSquareText}>
          {latestFeedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun feedback registrato.</p>
          ) : (
            <ul className="space-y-4">
              {latestFeedbacks.map((feedback) => (
                <li key={feedback.id} className="space-y-1">
                  <p className="text-sm leading-relaxed whitespace-pre-line">{feedback.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {FEEDBACK_TYPE_LABELS[feedback.type]} · {feedback.selectionTitle} · {feedback.author.displayName},{" "}
                    {formatDateTime(feedback.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      </div>

      <aside className="space-y-6" aria-label="Riepilogo">
        <DetailSection title="Riepilogo" icon={UserRound}>
          <dl className="grid gap-4">
            <DetailField label="Recruiter principale">{profile.primaryRecruiter?.displayName}</DetailField>
            <DetailField label="Candidature attive">
              {String(profile.applications.filter((view) => !view.stage.isTerminal).length)}
            </DetailField>
            <DetailField label="Email">
              {candidate.email && (
                <a href={`mailto:${candidate.email}`} className="break-all underline-offset-4 hover:underline">
                  {candidate.email}
                </a>
              )}
            </DetailField>
            <DetailField label="Telefono">
              {candidate.phone && (
                <a href={`tel:${candidate.phone.replace(/\s+/g, "")}`} className="underline-offset-4 hover:underline">
                  {candidate.phone}
                </a>
              )}
            </DetailField>
            {profile.tags.length > 0 && (
              <DetailField label="Etichette">
                <span className="flex flex-wrap gap-1.5">
                  {profile.tags.map((tag) => (
                    <span key={tag.id} className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                      {tag.name}
                    </span>
                  ))}
                </span>
              </DetailField>
            )}
          </dl>
        </DetailSection>

        <DetailSection
          title="Percorso e politiche attive"
          icon={Route}
          action={canEdit ? <EditTrackingButton candidate={candidate} /> : undefined}
        >
          <dl className="grid gap-4">
            <DetailField label="Origine">{CANDIDATE_ORIGIN_LABELS[candidate.origin]}</DetailField>
            <DetailField label="Orientamento">
              {candidate.orientationCompletedOn ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Completato il {formatDate(candidate.orientationCompletedOn)}
                </span>
              ) : (
                "Non completato"
              )}
            </DetailField>
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
