import { IdCard, Settings2 } from "lucide-react";

import { DetailField, DetailList, DetailSection } from "@/components/common/detail-section";
import {
  AVAILABILITY_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  GENDER_LABELS,
  labelOf,
  PROTECTED_CATEGORY_LABELS,
  RESIDENCE_PERMIT_STATUS_LABELS,
  WORK_MODE_LABELS,
  WORK_TIME_LABELS,
} from "@/config/labels";
import { daysUntil, formatDate, formatDateTime, formatMonths, getAge } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CandidateProfileView } from "@/services/candidate-service";

import { EditIdentityButton, EditPreferencesButton, EditProfileButton } from "../section-forms";

const yesNo = (value: boolean | null) => (value === null ? null : value ? "Sì" : "No");

/** Campo mostrato solo se valorizzato: i vuoti finiscono nella riga "Da completare". */
type Entry = { label: string; value: React.ReactNode; wide?: boolean };
const filled = (value: React.ReactNode) => value !== null && value !== undefined && value !== "" && value !== false;

function Group({ title, entries }: { title: string; entries: Entry[] }) {
  const shown = entries.filter((entry) => filled(entry.value));
  if (shown.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <DetailList>
        {shown.map((entry) => (
          <DetailField key={entry.label} label={entry.label} className={entry.wide ? "sm:col-span-2" : undefined}>
            {entry.value}
          </DetailField>
        ))}
      </DetailList>
    </div>
  );
}

/**
 * Dati della persona senza ripetere la colonna di sintesi (nome, contatti, nazionalità):
 * solo i campi compilati, raggruppati; quelli mancanti sono elencati in una riga.
 */
export function PersonalDetailsPanel({ profile, canEdit }: { profile: CandidateProfileView; canEdit: boolean }) {
  const { candidate } = profile;
  const data = profile.profile;
  const age = getAge(candidate.birthDate);
  const permitDays = daysUntil(candidate.residencePermitExpiresOn);
  const residence = [
    data.residenceAddress,
    [data.residencePostalCode, data.residenceCity, data.residenceProvince && `(${data.residenceProvince})`]
      .filter(Boolean)
      .join(" "),
    data.residenceRegion,
    data.residenceCountry && data.residenceCountry !== "IT" ? data.residenceCountry : null,
  ]
    .filter(Boolean)
    .join(", ");
  const permitRelevant = candidate.residencePermitStatus !== null && candidate.residencePermitStatus !== "NOT_REQUIRED";

  const professional: Entry[] = [
    {
      label: "Sintesi professionale",
      wide: true,
      value: data.professionalSummary && (
        <span className="leading-relaxed whitespace-pre-line">{data.professionalSummary}</span>
      ),
    },
    { label: "Settore di esperienza", value: data.experienceSector },
    { label: "Esperienza dichiarata", value: data.experienceMonths ? formatMonths(data.experienceMonths) : null },
    {
      label: "Stato occupazionale",
      value: data.employmentStatus !== "UNKNOWN" && labelOf(EMPLOYMENT_STATUS_LABELS, data.employmentStatus),
    },
    {
      label: "Disponibilità",
      value: profile.preferences.availability && labelOf(AVAILABILITY_LABELS, profile.preferences.availability),
    },
    { label: "Note disponibilità", wide: true, value: profile.preferences.availabilityNotes },
    {
      label: "Categoria protetta",
      value: data.protectedCategory !== "NOT_SPECIFIED" && labelOf(PROTECTED_CATEGORY_LABELS, data.protectedCategory),
    },
    { label: "Note categoria protetta", wide: true, value: data.protectedCategoryNotes },
  ];
  const personal: Entry[] = [
    {
      label: "Codice fiscale",
      value: candidate.fiscalCode && <span className="font-mono">{candidate.fiscalCode}</span>,
    },
    {
      label: "Data di nascita",
      value: candidate.birthDate && `${formatDate(candidate.birthDate)}${age !== null ? ` (${age} anni)` : ""}`,
    },
    { label: "Genere", value: candidate.gender !== "NOT_SPECIFIED" && labelOf(GENDER_LABELS, candidate.gender) },
    { label: "Residenza", wide: true, value: residence },
    {
      label: "Permesso di soggiorno",
      wide: true,
      value: (permitRelevant || candidate.residencePermitExpiresOn) && (
        <span className="space-y-0.5">
          <span className="block">{labelOf(RESIDENCE_PERMIT_STATUS_LABELS, candidate.residencePermitStatus, "")}</span>
          {candidate.residencePermitExpiresOn && (
            <span
              className={cn(
                "block text-xs",
                permitDays !== null && permitDays < 0
                  ? "font-medium text-destructive"
                  : permitDays !== null && permitDays <= 60
                    ? "font-medium text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {permitDays !== null && permitDays < 0 ? "Scaduto il " : "Scade il "}
              {formatDate(candidate.residencePermitExpiresOn)}
            </span>
          )}
          {candidate.residencePermitNotes && (
            <span className="block text-xs whitespace-pre-line text-muted-foreground">
              {candidate.residencePermitNotes}
            </span>
          )}
        </span>
      ),
    },
  ];
  const missing = [
    !data.professionalSummary && !data.experienceSector && "profilo professionale",
    !candidate.fiscalCode && "codice fiscale",
    !candidate.birthDate && "data di nascita",
    !residence && "residenza",
    !profile.preferences.availability && "disponibilità",
    data.employmentStatus === "UNKNOWN" && "stato occupazionale",
    candidate.residencePermitStatus === null && "permesso di soggiorno",
  ].filter(Boolean);

  return (
    <DetailSection
      title="Dati personali"
      icon={IdCard}
      action={
        canEdit ? (
          <span className="flex flex-wrap gap-2">
            <EditIdentityButton candidate={candidate} label="Anagrafica" />
            <EditProfileButton profile={data} label="Profilo e residenza" />
          </span>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <Group title="Profilo professionale" entries={professional} />
        <Group title="Anagrafica e residenza" entries={personal} />
        {missing.length > 0 && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Da completare:</span> {missing.join(", ")}.
          </p>
        )}
        {profile.tags.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {profile.tags.map((tag) => (
              <span key={tag.id} className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs">
                {tag.name}
              </span>
            ))}
          </span>
        )}
        <p className="text-xs text-muted-foreground">
          Inserito il {formatDateTime(candidate.createdAt)}
          {data.lastReviewedAt && ` · ultima revisione ${formatDateTime(data.lastReviewedAt)}`}
        </p>
      </div>
    </DetailSection>
  );
}

export function PreferencesPanel({ profile, canEdit }: { profile: CandidateProfileView; canEdit: boolean }) {
  const preferences = profile.preferences;
  return (
    <DetailSection
      title="Preferenze professionali"
      icon={Settings2}
      action={canEdit ? <EditPreferencesButton preferences={preferences} /> : undefined}
    >
      <DetailList className="lg:grid-cols-3">
        <DetailField label="Disponibilità">{labelOf(AVAILABILITY_LABELS, preferences.availability, "")}</DetailField>
        <DetailField label="Modalità di lavoro">
          {labelOf(WORK_MODE_LABELS, preferences.desiredWorkMode, "")}
        </DetailField>
        <DetailField label="Orario">{labelOf(WORK_TIME_LABELS, preferences.desiredWorkTime, "")}</DetailField>
        <DetailField label="Tipologia contratto">
          {labelOf(WORK_TIME_LABELS, preferences.desiredEmploymentType, "")}
        </DetailField>
        <DetailField label="Disponibile al trasferimento">{yesNo(preferences.willingToRelocate)}</DetailField>
        <DetailField label="Disponibile a trasferte">{yesNo(preferences.willingToTravel)}</DetailField>
        <DetailField label="Sedi preferite" className="sm:col-span-2 lg:col-span-3">
          {preferences.preferredLocations.join(", ")}
        </DetailField>
        <DetailField label="Note sulla disponibilità" className="sm:col-span-2 lg:col-span-3">
          {preferences.availabilityNotes}
        </DetailField>
      </DetailList>
    </DetailSection>
  );
}
