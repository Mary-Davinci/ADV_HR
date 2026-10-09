import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";

export const metadata: Metadata = { title: "Accesso negato" };

export default function ForbiddenPage() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Accesso non consentito"
      description="Il tuo ruolo non prevede l'accesso a questa sezione. Se pensi sia un errore, contatta un amministratore."
      action={<ButtonLink href="/dashboard">Torna alla dashboard</ButtonLink>}
    />
  );
}
