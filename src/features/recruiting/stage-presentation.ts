import {
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleX,
  Eye,
  Phone,
  Repeat,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { StatusTone } from "@/components/common/status-badge";

/**
 * Presentazione visiva degli stage. Gli stage vivono nel DATABASE
 * (`recruiting_stages`): qui solo tono e icona per i codici noti, con
 * fallback neutro per stage aggiunti in futuro. La label arriva sempre dal DB.
 */
const STAGE_PRESENTATION: Record<string, { tone: StatusTone; icon: LucideIcon }> = {
  NEW: { tone: "info", icon: Sparkles },
  TO_REVIEW: { tone: "warning", icon: Eye },
  CONTACTED: { tone: "neutral", icon: Phone },
  INTERVIEW_SCHEDULED: { tone: "progress", icon: CalendarClock },
  INTERVIEWED: { tone: "progress", icon: CalendarCheck },
  SECOND_INTERVIEW: { tone: "progress", icon: Repeat },
  SELECTED: { tone: "success", icon: CircleCheck },
  REJECTED: { tone: "danger", icon: CircleX },
  ON_HOLD: { tone: "neutral", icon: CirclePause },
};

const FALLBACK = { tone: "neutral" as const, icon: CircleDashed };

export function getStagePresentation(code: string): { tone: StatusTone; icon: LucideIcon } {
  return STAGE_PRESENTATION[code] ?? FALLBACK;
}
