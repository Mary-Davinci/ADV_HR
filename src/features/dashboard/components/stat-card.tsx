import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  /** Link alla lista già filtrata: ogni numero porta al dettaglio. */
  href: string;
  tone?: "warning";
}

export function StatCard({ label, value, hint, icon: Icon, href, tone }: StatCardProps) {
  return (
    <Card className="relative gap-2 p-5 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={href}
          className="text-sm font-medium text-muted-foreground outline-none after:absolute after:inset-0"
        >
          {label}
        </Link>
        <Icon
          aria-hidden="true"
          className={cn("size-4 text-muted-foreground", tone === "warning" && "text-amber-600 dark:text-amber-400")}
        />
      </div>
      <p
        className={cn(
          "text-3xl font-semibold tracking-tight tabular-nums",
          tone === "warning" && "text-amber-700 dark:text-amber-300",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}
