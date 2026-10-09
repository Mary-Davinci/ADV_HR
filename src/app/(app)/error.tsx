"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/common/error-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      description={
        error.digest
          ? `Non è stato possibile caricare la pagina. Codice di riferimento: ${error.digest}`
          : "Non è stato possibile caricare la pagina. Riprova tra qualche istante."
      }
      onRetry={reset}
    />
  );
}
