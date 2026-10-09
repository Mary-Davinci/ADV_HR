import { Compass } from "lucide-react";

import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <EmptyState
        icon={Compass}
        title="Pagina non trovata"
        description="L'indirizzo richiesto non esiste o è stato spostato."
        action={<ButtonLink href="/dashboard">Vai alla dashboard</ButtonLink>}
        className="w-full max-w-lg"
      />
    </main>
  );
}
