import { Skeleton } from "@/components/ui/skeleton";

export default function SelectionLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Caricamento selezione…</span>
      <Skeleton className="h-7 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-full max-w-lg" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
