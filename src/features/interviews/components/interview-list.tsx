import { MapPin, Phone, Video } from "lucide-react";
import Link from "next/link";

import { INTERVIEW_TYPE_LABELS } from "@/config/labels";
import type { UserRef } from "@/domain";
import { InterviewStatusBadge } from "@/features/recruiting/components/badges";
import { formatRelativeDay, formatTime } from "@/lib/format";
import type { InterviewView } from "@/repositories/types";

import { InterviewEditButton } from "./interview-edit-button";

function ModeIcon({ view }: { view: InterviewView }) {
  if (view.interview.meetingUrl) return <Video aria-hidden="true" className="size-3.5" />;
  if (view.interview.type === "SCREENING") return <Phone aria-hidden="true" className="size-3.5" />;
  return <MapPin aria-hidden="true" className="size-3.5" />;
}

/**
 * Elenco colloqui in formato agenda: orario in evidenza, poi candidato,
 * selezione e stato. `showCandidate=false` nella scheda del candidato.
 */
export function InterviewList({
  items,
  recruiters,
  canManage,
  showCandidate = true,
  emptyText = "Nessun colloquio.",
}: {
  items: InterviewView[];
  recruiters: UserRef[];
  canManage: boolean;
  showCandidate?: boolean;
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((view) => (
        <li key={view.interview.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="w-24 shrink-0">
              <p className="text-sm font-semibold tabular-nums">{formatTime(view.interview.scheduledAt)}</p>
              <p className="text-xs text-muted-foreground first-letter:uppercase">
                {formatRelativeDay(view.interview.scheduledAt)}
              </p>
            </div>
            <div className="min-w-0 space-y-0.5">
              {showCandidate && (
                <Link
                  href={`/recruiting/${view.candidate.id}?tab=applications`}
                  className="text-sm font-medium hover:underline"
                >
                  {view.candidate.fullName}
                </Link>
              )}
              <p className="truncate text-sm text-muted-foreground">
                <Link
                  href={`/companies/${view.company.id}/selections/${view.selection.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {view.selection.title}
                </Link>{" "}
                · {view.company.name}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ModeIcon view={view} />
                {INTERVIEW_TYPE_LABELS[view.interview.type]}
                {view.interview.durationMinutes && ` · ${view.interview.durationMinutes} min`}
                {view.recruiter && ` · ${view.recruiter.displayName}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <InterviewStatusBadge status={view.interview.status} />
            {canManage && (
              <InterviewEditButton
                interview={view.interview}
                candidateName={view.candidate.fullName}
                recruiters={recruiters}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
