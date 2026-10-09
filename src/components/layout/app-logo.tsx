import Image from "next/image";

import { cn } from "@/lib/utils";

export function AppLogo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* Il marchio ha fondo bianco: il contenitore bianco lo integra anche in tema scuro. */}
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
        <Image src="/brand/adv-logo.jpg" alt="" width={32} height={32} className="size-8 object-contain" priority />
      </span>
      {withWordmark && (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">ADV_HR</span>
          <span className="text-xs text-muted-foreground">Accademia Da Vinci</span>
        </span>
      )}
    </span>
  );
}
