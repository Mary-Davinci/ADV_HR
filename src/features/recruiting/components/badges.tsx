import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  FilePenLine,
  Pause,
  PlayCircle,
  Archive,
  Lock,
  UserX,
} from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import {
  EVALUATION_RESULT_LABELS,
  INTERVIEW_STATUS_LABELS,
  SELECTION_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/config/labels";
import type { EvaluationResult, InterviewStatus, SelectionStatus, TaskPriority } from "@/domain";

import { getStagePresentation } from "../stage-presentation";

/** Badge dello stage: label dal database, tono/icona dalla presentazione. */
export function StageBadge({ code, label, className }: { code: string; label: string; className?: string }) {
  const { tone, icon } = getStagePresentation(code);
  return <StatusBadge label={label} tone={tone} icon={icon} className={className} />;
}

const EVALUATION_PRESENTATION: Record<EvaluationResult, { tone: StatusTone; icon: typeof CircleCheck }> = {
  SUITABLE: { tone: "success", icon: CircleCheck },
  NOT_SUITABLE: { tone: "danger", icon: CircleX },
  TO_REVIEW: { tone: "warning", icon: CircleHelp },
};

export function EvaluationBadge({ result }: { result: EvaluationResult | null }) {
  if (!result) return <StatusBadge label="Da valutare" tone="neutral" icon={CircleAlert} />;
  const { tone, icon } = EVALUATION_PRESENTATION[result];
  return <StatusBadge label={EVALUATION_RESULT_LABELS[result]} tone={tone} icon={icon} />;
}

const SELECTION_PRESENTATION: Record<SelectionStatus, { tone: StatusTone; icon: typeof CircleCheck }> = {
  DRAFT: { tone: "neutral", icon: FilePenLine },
  OPEN: { tone: "success", icon: PlayCircle },
  PAUSED: { tone: "warning", icon: Pause },
  CLOSED: { tone: "neutral", icon: Lock },
  ARCHIVED: { tone: "neutral", icon: Archive },
};

export function SelectionStatusBadge({ status }: { status: SelectionStatus }) {
  const { tone, icon } = SELECTION_PRESENTATION[status];
  return <StatusBadge label={SELECTION_STATUS_LABELS[status]} tone={tone} icon={icon} />;
}

const INTERVIEW_PRESENTATION: Record<InterviewStatus, { tone: StatusTone; icon: typeof CircleCheck }> = {
  SCHEDULED: { tone: "progress", icon: CalendarClock },
  COMPLETED: { tone: "success", icon: CalendarCheck },
  CANCELLED: { tone: "neutral", icon: CalendarX },
  NO_SHOW: { tone: "danger", icon: UserX },
};

export function InterviewStatusBadge({ status }: { status: InterviewStatus }) {
  const { tone, icon } = INTERVIEW_PRESENTATION[status];
  return <StatusBadge label={INTERVIEW_STATUS_LABELS[status]} tone={tone} icon={icon} />;
}

const PRIORITY_TONE: Record<TaskPriority, StatusTone> = { LOW: "neutral", MEDIUM: "info", HIGH: "danger" };

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <StatusBadge label={`Priorità ${TASK_PRIORITY_LABELS[priority].toLowerCase()}`} tone={PRIORITY_TONE[priority]} />
  );
}
