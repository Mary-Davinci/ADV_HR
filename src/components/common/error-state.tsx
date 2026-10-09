"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

import { EmptyState } from "./empty-state";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Si è verificato un errore",
  description = "Non è stato possibile caricare i dati. Riprova tra qualche istante.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert">
      <EmptyState
        icon={TriangleAlert}
        title={title}
        description={description}
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              Riprova
            </Button>
          )
        }
      />
    </div>
  );
}
