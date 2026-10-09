"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const ALL_VALUE = "__all__";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  /** Nome accessibile (i filtri non hanno label visibile per compattezza). */
  label: string;
  value: string | undefined;
  options: FilterOption[];
  allLabel: string;
  onChange: (value: string | undefined) => void;
  className?: string;
  id?: string;
}

/** Select per filtri: la prima voce ("Tutti…") azzera il filtro. */
export function FilterSelect({ label, value, options, allLabel, onChange, className, id }: FilterSelectProps) {
  const items = [{ value: ALL_VALUE, label: allLabel }, ...options];
  return (
    <Select
      items={items}
      value={value ?? ALL_VALUE}
      onValueChange={(next) => onChange(next === ALL_VALUE || next === null ? undefined : String(next))}
    >
      <SelectTrigger id={id} aria-label={label} className={cn("h-9 w-full sm:w-auto sm:min-w-44", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
