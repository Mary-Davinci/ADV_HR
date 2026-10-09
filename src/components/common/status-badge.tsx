import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Tono visivo del badge. */
export type StatusTone = "neutral" | "info" | "progress" | "warning" | "success" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-foreground/80",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200",
  progress:
    "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/25 dark:bg-indigo-400/10 dark:text-indigo-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200",
  danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200",
};

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  icon?: LucideIcon;
  className?: string;
}

/** Badge di stato generico: colore + icona + testo, mai solo colore. */
export function StatusBadge({ label, tone, icon: Icon, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1.5 px-2 font-medium", TONE_CLASSES[tone], className)}>
      {Icon && <Icon aria-hidden="true" data-icon="inline-start" />}
      {label}
    </Badge>
  );
}
