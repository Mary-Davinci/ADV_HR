import { Database, ListOrdered, UserRound } from "lucide-react";
import type { Metadata } from "next";

import { DetailField, DetailList, DetailSection } from "@/components/common/detail-section";
import { PageHeader } from "@/components/common/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/config/labels";
import { StageBadge } from "@/features/recruiting/components/badges";
import { permissionsOf } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const user = await requirePermission("settings.read");
  const services = await getServices();
  const stages = await services.applications.listStages();

  return (
    <div className="space-y-6">
      <PageHeader title="Impostazioni" description="Profilo, pipeline di selezione e informazioni di sistema." />

      <DetailSection title="Il tuo profilo" icon={UserRound}>
        <DetailList>
          <DetailField label="Nome">{user.name}</DetailField>
          <DetailField label="Email">{user.email}</DetailField>
          <DetailField label="Ruoli">{user.roles.map((role) => ROLE_LABELS[role]).join(", ")}</DetailField>
          <DetailField label="Permessi">{`${permissionsOf(user).length} permessi attivi`}</DetailField>
        </DetailList>
      </DetailSection>

      <DetailSection title="Pipeline di selezione" icon={ListOrdered}>
        <p className="mb-4 text-sm text-muted-foreground">
          Gli stage sono configurati nel database (tabella <code className="font-mono text-xs">recruiting_stages</code>
          ), non nel codice. L&apos;editor visuale della pipeline è previsto in una prossima versione.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <caption className="sr-only">Stage della pipeline</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-4">Ordine</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Codice</TableHead>
                <TableHead>Conclusivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((stage) => (
                <TableRow key={stage.id}>
                  <TableCell className="pl-4 tabular-nums">{stage.position}</TableCell>
                  <TableCell>
                    <StageBadge code={stage.code} label={stage.label} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{stage.code}</TableCell>
                  <TableCell>{stage.isTerminal ? "Sì" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DetailSection>

      <DetailSection title="Sistema" icon={Database}>
        <DetailList>
          <DetailField label="Sorgente dati">Database ADV_HR (PostgreSQL)</DetailField>
          <DetailField label="Integrazione ADV CORE">Non attiva — prevista come sorgente in sola lettura</DetailField>
          <DetailField label="Matching automatico">Non attivo — predisposto (regole spiegabili + pgvector)</DetailField>
          <DetailField label="Tema">Selezionabile dall&apos;icona nell&apos;intestazione</DetailField>
        </DetailList>
      </DetailSection>
    </div>
  );
}
