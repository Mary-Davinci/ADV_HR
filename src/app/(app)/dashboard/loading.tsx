import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Caricamento dashboard…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
