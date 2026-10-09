"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { FilterSelect, type FilterOption } from "./filter-select";
import { SearchInput } from "./search-input";

export interface UrlSelectFilter {
  param: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
}

/**
 * Barra filtri generica per liste semplici: testo + select, stato nei
 * search params (validati poi lato server con Zod).
 */
export function UrlFilterBar({
  searchLabel,
  searchPlaceholder,
  selects = [],
  searchParam = "q",
}: {
  searchLabel?: string;
  searchPlaceholder?: string;
  selects?: UrlSelectFilter[];
  searchParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = params.get(searchParam) ?? "";
  const [text, setText] = useState(current);
  const [synced, setSynced] = useState(current);
  if (current !== synced) {
    setSynced(current);
    setText(current);
  }

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (!searchLabel || text.trim() === current) return;
    const timeout = setTimeout(() => update({ [searchParam]: text.trim() || undefined }), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si reagisce solo al testo digitato
  }, [text]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" role="search">
      {searchLabel && (
        <SearchInput
          value={text}
          onValueChange={setText}
          label={searchLabel}
          placeholder={searchPlaceholder}
          className="sm:w-80"
        />
      )}
      {selects.map((select) => (
        <FilterSelect
          key={select.param}
          label={select.label}
          allLabel={select.allLabel}
          value={params.get(select.param) ?? undefined}
          options={select.options}
          onChange={(value) => update({ [select.param]: value })}
        />
      ))}
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {isPending && <Loader2 aria-label="Aggiornamento risultati" className="size-4 animate-spin" />}
      </span>
    </div>
  );
}
