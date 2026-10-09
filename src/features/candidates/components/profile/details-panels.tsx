import { MapPin, Settings2, UserRound } from "lucide-react";

import { DetailField, DetailList, DetailSection } from "@/components/common/detail-section";
import {
  AVAILABILITY_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  GENDER_LABELS,
  labelOf,
  PROTECTED_CATEGORY_LABELS,
  WORK_MODE_LABELS,
  WORK_TIME_LABELS,
} from "@/config/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CandidateProfileView } from "@/services/candidate-service";

import { EditIdentityButton, EditPreferencesButton, EditProfileButton } from "../section-forms";

const yesNo = (value: boolean | null) => (value === null ? null : value ? "Sì" : "No");

export function ProfilePanel({ profile, canEdit }: { profile: CandidateProfileView; canEdit: boolean }) {
  const { candidate } = profile;
  const data = profile.profile;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DetailSection
        title="Anagrafica"
        icon={UserRound}
        action={canEdit ? <EditIdentityButton candidate={candidate} /> : undefined}
      >
        <DetailList>
          <DetailField label="Nome">{candidate.firstName}</DetailField>
          <DetailField label="Cognome">{candidate.lastName}</DetailField>
          <DetailField label="Codice fiscale">
            {candidate.fiscalCode && <span className="font-mono">{candidate.fiscalCode}</span>}
          </DetailField>
          <DetailField label="Data di nascita">{candidate.birthDate && formatDate(candidate.birthDate)}</DetailField>
          <DetailField label="Email">{candidate.email}</DetailField>
          <DetailField label="Telefono">{candidate.phone}</DetailField>
          <DetailField label="Genere">{labelOf(GENDER_LABELS, candidate.gender)}</DetailField>
          <DetailField label="Inserito il">{formatDateTime(candidate.createdAt)}</DetailField>
        </DetailList>
      </DetailSection>

      <DetailSection
        title="Profilo e residenza"
        icon={MapPin}
        action={canEdit ? <EditProfileButton profile={data} /> : undefined}
      >
        <DetailList>
          <DetailField label="Sintesi professionale" className="sm:col-span-2">
            {data.professionalSummary && (
              <span className="leading-relaxed whitespace-pre-line">{data.professionalSummary}</span>
            )}
          </DetailField>
          <DetailField label="Stato occupazionale">
            {labelOf(EMPLOYMENT_STATUS_LABELS, data.employmentStatus)}
          </DetailField>
          <DetailField label="Categoria protetta">
            {labelOf(PROTECTED_CATEGORY_LABELS, data.protectedCategory)}
          </DetailField>
          {data.protectedCategoryNotes && (
            <DetailField label="Note categoria protetta" className="sm:col-span-2">
              {data.protectedCategoryNotes}
            </DetailField>
          )}
          <DetailField label="Indirizzo" className="sm:col-span-2">
            {data.residenceAddress}
          </DetailField>
          <DetailField label="Città">
            {[data.residenceCity, data.residenceProvince && `(${data.residenceProvince})`].filter(Boolean).join(" ")}
          </DetailField>
          <DetailField label="Regione">{data.residenceRegion}</DetailField>
          <DetailField label="Ultima revisione">
            {data.lastReviewedAt && formatDateTime(data.lastReviewedAt)}
          </DetailField>
        </DetailList>
      </DetailSection>
    </div>
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
