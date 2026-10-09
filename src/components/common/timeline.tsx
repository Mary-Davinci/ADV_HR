import { format, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import { History } from "lucide-react";

import {
  ACTIVITY_ACTION_LABELS,
  SELECTION_STATUS_LABELS,
  TASK_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  EVALUATION_RESULT_LABELS,
  INTERVIEW_TYPE_LABELS,
} from "@/config/labels";
import { isContactAction, type Activity } from "@/domain";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
  identity: "anagrafica",
  profile: "profilo",
  preferences: "preferenze",
  experiences: "esperienze",
  education: "formazione",
  interests: "interessi",
  languages: "lingue",
  certifications: "certificazioni",
  drivingLicenses: "patenti",
  activePolicies: "politiche attive",
  skills: "competenze",
  jobDescription: "job description",
};

const ENTITY_LABELS: Record<string, string> = {
  CANDIDATE: "Profilo",
  APPLICATION: "Candidatura",
  INTERVIEW: "Colloquio",
  COMPANY: "Azienda",
  SELECTION: "Selezione",
  DOCUMENT: "Documento",
  TASK: "Task",
  TALENT_POOL: "Talent pool",
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Frase leggibile per un evento: niente codici tecnici in interfaccia. */
export function describeActivity(activity: Activity): { title: string; detail: string | null } {
  const meta = activity.metadata;
  switch (activity.action) {
    case "STATUS_CHANGED": {
      // Le label arrivano dai metadati; per selezioni e task si traducono i codici di stato.
      const statusLabels: Record<string, string> =
        activity.entityType === "SELECTION"
          ? SELECTION_STATUS_LABELS
          : activity.entityType === "TASK"
            ? TASK_STATUS_LABELS
            : {};
      const code = (value: unknown) => {
        const text = asString(value);
        return text ? (statusLabels[text] ?? text) : null;
      };
      const from = asString(meta.fromLabel) ?? code(meta.from);
      const to = asString(meta.toLabel) ?? code(meta.to);
      return {
        title: `${ENTITY_LABELS[activity.entityType] ?? ""}: stato cambiato`.trim(),
        detail: from && to ? `${from} → ${to}` : null,
      };
    }
    case "UPDATED": {
      const section = asString(meta.section);
      return {
        title: `${ENTITY_LABELS[activity.entityType] ?? "Elemento"} aggiornato`,
        detail: section ? `Sezione: ${SECTION_LABELS[section] ?? section}` : null,
      };
    }
    case "CREATED":
      return {
        title: `${ENTITY_LABELS[activity.entityType] ?? "Elemento"} creato`,
        detail: asString(meta.title) ?? asString(meta.name),
      };
    case "APPLICATION_CREATED":
      return { title: "Candidatura creata", detail: asString(meta.selectionTitle) };
    case "EVALUATION_ADDED": {
      const result = asString(meta.result);
      return {
        title: "Valutazione registrata",
        detail: result ? (EVALUATION_RESULT_LABELS[result as keyof typeof EVALUATION_RESULT_LABELS] ?? null) : null,
      };
    }
    case "INTERVIEW_SCHEDULED": {
      const type = asString(meta.type);
      return {
        title: "Colloquio programmato",
        detail: type ? (INTERVIEW_TYPE_LABELS[type as keyof typeof INTERVIEW_TYPE_LABELS] ?? null) : null,
      };
    }
    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_DELETED": {
      const type = asString(meta.type);
      return {
        title: ACTIVITY_ACTION_LABELS[activity.action],
        detail: type ? (DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] ?? null) : null,
      };
    }
    case "ADDED_TO_POOL":
    case "REMOVED_FROM_POOL":
      return { title: ACTIVITY_ACTION_LABELS[activity.action], detail: asString(meta.pool) };
    case "TASK_CREATED":
    case "TASK_COMPLETED":
      return { title: ACTIVITY_ACTION_LABELS[activity.action], detail: asString(meta.title) };
    default:
      return {
        title: isContactAction(activity.action)
          ? `Contatto: ${ACTIVITY_ACTION_LABELS[activity.action].toLowerCase()}`
          : ACTIVITY_ACTION_LABELS[activity.action],
        detail: asString(meta.note),
      };
  }
}

interface TimelineProps {
  activities: Activity[];
  emptyText?: string;
  className?: string;
}

/** Timeline cronologica raggruppata per giorno (più recenti in alto). */
export function Timeline({ activities, emptyText = "Nessuna attività registrata.", className }: TimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <History aria-hidden="true" className="size-5" />
        {emptyText}
      </div>
    );
  }

  return (
    <ol className={cn("relative space-y-4 border-l pl-5", className)}>
      {activities.map((activity, index) => {
        const { title, detail } = describeActivity(activity);
        const previous = activities[index - 1];
        const showDay = !previous || !isSameDay(previous.createdAt, activity.createdAt);
        const contact = isContactAction(activity.action);
        return (
          <li key={activity.id} className="relative">
            {showDay && (
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase first-letter:uppercase">
                {format(activity.createdAt, "EEEE d MMMM yyyy", { locale: it })}
              </p>
            )}
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-[1.42rem] mt-1.5 size-2 rounded-full ring-4 ring-card",
                contact ? "bg-primary" : "bg-muted-foreground/40",
              )}
              style={{ top: showDay ? "1.5rem" : 0 }}
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <time dateTime={activity.createdAt.toISOString()} className="text-xs text-muted-foreground tabular-nums">
                {format(activity.createdAt, "HH:mm")}
              </time>
              <p className="text-sm font-medium">{title}</p>
            </div>
            {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
            {activity.actor && <p className="text-xs text-muted-foreground">da {activity.actor.displayName}</p>}
          </li>
        );
      })}
    </ol>
  );
}
