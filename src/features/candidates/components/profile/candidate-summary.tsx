import { CalendarCheck, CalendarClock, CircleAlert, ClipboardPen, Mail, Phone } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AVAILABILITY_LABELS, DRIVING_LICENSE_LABELS, WORK_TIME_LABELS } from "@/config/labels";
import { getTotalExperienceMonths } from "@/domain";
import { StageBadge } from "@/features/recruiting/components/badges";
import { daysUntil, formatDate, formatMonths, formatSlot, formatTimeAgo, getAge, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CandidateProfileView } from "@/services/candidate-service";

import { EditRecruiterButton } from "../section-forms";
import { DocumentLinks } from "./document-links";

/** Cerchio e quadrato vitruviani del login, come filigrana dietro l'intestazione. */
function VitruvianWatermark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 390 390"
      className="pointer-events-none absolute -top-8 left-1/2 w-[24rem] -translate-x-1/2"
    >
      <g fill="none" stroke="#c9a24a">
        <circle cx="195" cy="150" r="140" strokeOpacity="0.28" />
        <circle cx="195" cy="150" r="147" strokeOpacity="0.2" strokeWidth="7" strokeDasharray="1 11.8" />
        <rect x="80" y="59" width="230" height="230" strokeOpacity="0.18" />
      </g>
    </svg>
  );
}

/** Ruolo da mostrare sotto il nome: esperienza in corso, poi la più recente, poi il settore dichiarato. */
function headline(profile: CandidateProfileView): string | null {
  const experiences = [...profile.experiences].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const role =
    (experiences.find((item) => item.currentRole) ?? experiences[0])?.roleTitle ?? profile.profile.experienceSector;
  const months = profile.experiences.length
    ? getTotalExperienceMonths(profile.experiences)
    : profile.profile.experienceMonths;
  return [role, months ? formatMonths(months) : null].filter(Boolean).join(" · ") || null;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 text-right text-sm font-medium", empty && "font-normal text-muted-foreground")}>
        {empty ? "Non indicato" : children}
      </dd>
    </div>
  );
}

/**
 * Colonna "a colpo d'occhio": chi è, cosa fa, dove, quando e con quali abilitazioni,
 * con contatti e azioni principali. I dettagli completi restano nelle schede a destra.
 */
export function CandidateSummary({
  profile,
  canEdit,
  recruiters,
  actions,
}: {
  profile: CandidateProfileView;
  canEdit: boolean;
  recruiters: Array<{ id: string; displayName: string }>;
  actions: React.ReactNode;
}) {
  const { candidate, profile: data, preferences } = profile;
  const latest = profile.applications[0];
  const age = getAge(candidate.birthDate);
  const role = headline(profile);
  const place = [data.residencePostalCode, data.residenceCity, data.residenceProvince && `(${data.residenceProvince})`]
    .filter(Boolean)
    .join(" ");
  const when = [
    preferences.availability && AVAILABILITY_LABELS[preferences.availability],
    preferences.desiredWorkTime && WORK_TIME_LABELS[preferences.desiredWorkTime].toLowerCase(),
  ]
    .filter(Boolean)
    .join(" · ");
  const licenses = profile.drivingLicenses
    .filter((license) => license.valid)
    .map((license) => DRIVING_LICENSE_LABELS[license.category]);
  const languages = profile.languages.map(
    (item) => `${item.language} ${item.level === "NATIVE" ? "madrelingua" : item.level}`,
  );

  return (
    <aside
      aria-label="Profilo in sintesi"
      className="relative flex min-w-0 flex-col gap-5 overflow-hidden rounded-2xl border border-[#e3d4b2] bg-[#fffdf8] p-6 dark:border-border dark:bg-card"
    >
      <VitruvianWatermark />
      <div className="relative flex flex-col items-center gap-3 pt-4 text-center">
        <Avatar className="size-20 shadow-[0_0_0_1px_#c9a24a,0_0_0_6px_#fffdf8,0_0_0_7px_rgba(201,162,74,0.35)] dark:shadow-[0_0_0_1px_#c9a24a]">
          <AvatarFallback className="bg-[radial-gradient(circle_at_45%_40%,#fbf7ee,#eee4cf)] font-(family-name:--font-display) text-3xl font-semibold text-[#6b4a14]">
            {getInitials(profile.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <h1 className="font-(family-name:--font-display) text-[2.1rem] leading-[1.05] font-semibold">
            <span className="sr-only">Scheda candidato: </span>
            {candidate.firstName} {candidate.lastName}
          </h1>
          {role && <p className="text-sm font-medium">{role}</p>}
          <p className="text-sm text-muted-foreground">
            {[age !== null ? `${age} anni` : null, candidate.nationality].filter(Boolean).join(" · ")}
          </p>
        </div>
        {latest ? (
          <span className="flex max-w-full min-w-0 flex-wrap items-center justify-center gap-2 text-sm">
            <StageBadge code={latest.stage.code} label={latest.stage.label} />
            <span className="min-w-0 truncate text-muted-foreground" title={latest.selection.title}>
              {latest.selection.title}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Nessuna candidatura</span>
        )}
      </div>

      <dl className="relative flex flex-col gap-3 border-t border-[#ecdfc3] pt-4 dark:border-border">
        <Fact label="Dove">{place}</Fact>
        <Fact label="Quando">{when}</Fact>
        <Fact label="Patenti">{licenses.join(", ")}</Fact>
        <Fact label="Certificazioni">{profile.certifications.map((item) => item.name).join(", ")}</Fact>
        <Fact label="Lingue">{languages.join(", ")}</Fact>
        <div className="flex items-center justify-between gap-4">
          <dt className="shrink-0 text-xs text-muted-foreground">Recruiter</dt>
          <dd className="flex min-w-0 items-center gap-1 text-right text-sm font-medium">
            {profile.primaryRecruiter?.displayName ?? (
              <span className="font-normal text-muted-foreground">Non assegnato</span>
            )}
            {canEdit && <EditRecruiterButton candidate={candidate} recruiters={recruiters} compact />}
          </dd>
        </div>
        {profile.documents.some((document) => document.type === "INTERVIEW_EVALUATION") && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-xs text-muted-foreground">Schede di valutazione</dt>
            <dd className="text-right">
              <DocumentLinks documents={profile.documents} type="INTERVIEW_EVALUATION" />
            </dd>
          </div>
        )}
      </dl>

      <div className="relative flex flex-col gap-1.5 border-t border-[#ecdfc3] pt-4 text-sm dark:border-border">
        {candidate.phone && (
          <a
            href={`tel:${candidate.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
          >
            <Phone aria-hidden="true" className="size-3.5 text-muted-foreground" />
            {candidate.phone}
          </a>
        )}
        {candidate.email && (
          <a
            href={`mailto:${candidate.email}`}
            className="inline-flex min-w-0 items-center gap-2 break-all underline-offset-4 hover:underline"
          >
            <Mail aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            {candidate.email}
          </a>
        )}
        <p className="text-xs text-muted-foreground">
          Ultimo contatto: {profile.lastContactAt ? formatTimeAgo(profile.lastContactAt) : "nessuno"} · aggiornato{" "}
          {formatTimeAgo(candidate.updatedAt)}
        </p>
      </div>

      {actions && <div className="relative flex flex-col gap-2 [&>*]:w-full">{actions}</div>}
    </aside>
  );
}

type Alert = { key: string; tone: "warning" | "info" | "danger"; icon: typeof CircleAlert; content: React.ReactNode };

const TONES = {
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  warning:
    "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100",
  info: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-100",
} as const;

/** Solo fatti verificabili nella scheda: niente giudizi automatici sul candidato. */
export function CandidateAlerts({ profile }: { profile: CandidateProfileView }) {
  const { candidate } = profile;
  const alerts: Alert[] = [];
  const permitDays = daysUntil(candidate.residencePermitExpiresOn);

  if (candidate.residencePermitStatus === "EXPIRED" || (permitDays !== null && permitDays < 0)) {
    alerts.push({
      key: "permit",
      tone: "danger",
      icon: CircleAlert,
      content: (
        <>
          <strong>Permesso di soggiorno scaduto</strong>
          {candidate.residencePermitExpiresOn && ` il ${formatDate(candidate.residencePermitExpiresOn)}`}
        </>
      ),
    });
  } else if (permitDays !== null && permitDays <= 60) {
    alerts.push({
      key: "permit",
      tone: "warning",
      icon: CircleAlert,
      content: (
        <>
          <strong>Permesso di soggiorno in scadenza</strong> il {formatDate(candidate.residencePermitExpiresOn)}, tra{" "}
          {permitDays === 1 ? "1 giorno" : `${permitDays} giorni`}
        </>
      ),
    });
  }

  if (profile.nextInterviewOverdue && profile.nextInterview) {
    alerts.push({
      key: "overdue",
      tone: "warning",
      icon: CalendarClock,
      content: (
        <>
          <strong>Colloquio del {formatSlot(profile.nextInterview.interview.scheduledAt)} ancora da chiudere</strong> ·{" "}
          <Link href="?tab=applications" className="underline underline-offset-4">
            segnalo come svolto o annullato
          </Link>
        </>
      ),
    });
  } else if (profile.nextInterview) {
    alerts.push({
      key: "next",
      tone: "info",
      icon: CalendarCheck,
      content: (
        <>
          <strong>Colloquio programmato {formatSlot(profile.nextInterview.interview.scheduledAt)}</strong> ·{" "}
          {profile.nextInterview.selection.title}
        </>
      ),
    });
  }

  const last = profile.lastCompletedInterview;
  if (
    last &&
    !(profile.evaluations[last.interview.applicationId] ?? []).some(
      (item) => item.evaluatedAt >= last.interview.scheduledAt,
    )
  ) {
    alerts.push({
      key: "evaluation",
      tone: "info",
      icon: ClipboardPen,
      content: (
        <>
          <strong>Colloquio del {formatDate(last.interview.scheduledAt)} senza esito registrato</strong> ·{" "}
          <Link href="?tab=applications" className="underline underline-offset-4">
            aggiungi la valutazione
          </Link>
        </>
      ),
    });
  }

  if (alerts.length === 0) return null;
  return (
    <section aria-label="Da controllare" className="flex flex-col gap-2">
      {alerts.map(({ key, tone, icon: Icon, content }) => (
        <p
          key={key}
          role="status"
          className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", TONES[tone])}
        >
          <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{content}</span>
        </p>
      ))}
    </section>
  );
}
