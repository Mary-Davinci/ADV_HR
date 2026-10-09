import { cn } from "@/lib/utils";

export interface CountItem {
  key: string;
  label: string;
  count: number;
}

/**
 * Distribuzione sintetica: etichetta, numero esplicito e barra proporzionale
 * come supporto visivo (l'informazione non dipende dal colore).
 */
export function CountList({
  items,
  emptyText = "Nessun dato nel periodo.",
  className,
}: {
  items: CountItem[];
  emptyText?: string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
          <span className="truncate">{item.label}</span>
          <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary/70"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-medium tabular-nums">{item.count}</span>
        </li>
      ))}
      <li className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_2.5rem] gap-3 border-t pt-2 text-sm text-muted-foreground">
        <span>Totale</span>
        <span />
        <span className="text-right font-medium text-foreground tabular-nums">{total}</span>
      </li>
    </ul>
  );
}
