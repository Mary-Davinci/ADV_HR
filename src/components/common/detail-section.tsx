import type { LucideIcon } from "lucide-react";

import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { EMPTY_VALUE } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DetailSectionProps {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function DetailSection({ title, icon: Icon, action, className, children }: DetailSectionProps) {
  const headingId = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <Card className={className} role="region" aria-labelledby={headingId}>
      <CardHeader>
        <h2 id={headingId} className="flex items-center gap-2 text-base leading-snug font-medium">
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
          {title}
        </h2>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Griglia di coppie etichetta/valore semanticamente corretta (`dl`). */
export function DetailList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>{children}</dl>;
}

interface DetailFieldProps {
  label: string;
  children?: React.ReactNode;
  className?: string;
  /** Valore mostrato in evidenza (es. data/ora del colloquio). */
  emphasis?: boolean;
}

export function DetailField({ label, children, className, emphasis }: DetailFieldProps) {
  const isEmpty = children === null || children === undefined || children === "";
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd
        className={cn("text-sm break-words", emphasis && "text-base font-semibold", isEmpty && "text-muted-foreground")}
      >
        {isEmpty ? EMPTY_VALUE : children}
      </dd>
    </div>
  );
}
