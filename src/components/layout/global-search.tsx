"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * Ricerca globale. Per ora cerca solo tra i candidati (porta alla lista
 * Ricerca & Selezione filtrata); in futuro potrà interrogare più domini.
 */
export function GlobalSearch() {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      className="relative hidden lg:block"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        router.push(query ? `/recruiting?q=${encodeURIComponent(query)}` : "/recruiting");
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Cerca candidati
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Cerca candidati…"
        className="h-8 w-64 pl-8"
        maxLength={100}
      />
    </form>
  );
}
