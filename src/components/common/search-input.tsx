"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}

/** Campo di ricerca con label accessibile (visivamente nascosta) e pulsante di reset. */
export function SearchInput({ value, onValueChange, label, placeholder, className }: SearchInputProps) {
  const id = useId();

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        maxLength={100}
        className="h-9 pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
          aria-label="Cancella ricerca"
          onClick={() => onValueChange("")}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
