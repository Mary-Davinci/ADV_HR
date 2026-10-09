import { UserX } from "lucide-react";

import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";

export default function CandidateNotFound() {
  return (
    <EmptyState
      icon={UserX}
      title="Candidato non trovato"
      description="Il candidato richiesto non esiste o non è più disponibile."
      action={<ButtonLink href="/recruiting">Torna a Ricerca & Selezione</ButtonLink>}
    />
  );
}
