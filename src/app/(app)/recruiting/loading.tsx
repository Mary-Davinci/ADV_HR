import { Skeleton } from "@/components/ui/skeleton";

export default function RecruitingLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Caricamento candidati…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        <Skeleton className="h-9 lg:w-96" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 sm:w-44" />
          ))}
        </div>
      </div>
      <div className="space-y-px overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-6 border-b px-4 py-4 last:border-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="hidden h-4 w-28 lg:block" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
