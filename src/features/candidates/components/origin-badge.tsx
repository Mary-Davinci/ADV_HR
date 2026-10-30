import { Globe, UserRound } from "lucide-react";
import Image from "next/image";

import { CANDIDATE_ORIGIN_LABELS } from "@/config/labels";
import type { CandidateOrigin } from "@/domain";
import { cn } from "@/lib/utils";

/**
 * Cerchietto con il segno della provenienza del candidato: il marchio di
 * Accademia Da Vinci per ADV Core, il segno delle piattaforme di annunci
 * (iniziale nei loro colori, non il logo registrato), una persona se inserito a mano.
 */
export function OriginBadge({ origin, className }: { origin: CandidateOrigin; className?: string }) {
  const label = `Origine: ${CANDIDATE_ORIGIN_LABELS[origin]}`;
  return (
    <span
      title={label}
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-bold select-none",
        origin === "ADV_CORE" && "border-[#e3cf9c] bg-white",
        origin === "LINKEDIN" && "border-transparent bg-[#0a66c2] text-white",
        origin === "INDEED" && "border-transparent bg-[#2164f3] text-white",
        origin === "MANUAL" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      {origin === "ADV_CORE" && (
        <Image src="/brand/adv-logo.jpg" alt="" width={28} height={28} className="size-full object-contain p-0.5" />
      )}
      {origin === "LINKEDIN" && (
        <span aria-hidden="true" className="font-sans tracking-tight">
          in
        </span>
      )}
      {origin === "INDEED" && (
        <span aria-hidden="true" className="font-serif text-sm italic">
          i
        </span>
      )}
      {origin === "MANUAL" && <UserRound aria-hidden="true" className="size-3.5" />}
      {origin === "WEBSITE" && <Globe aria-hidden="true" className="size-3.5" />}
    </span>
  );
}
