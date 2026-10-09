import { Skeleton } from "@/components/ui/skeleton";

export default function CandidateLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Caricamento scheda candidato…</span>
      <Skeleton className="h-7 w-36" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
