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
          Le fasi descrivono il percorso delle candidature. Colloqui ed esiti aggiornano il percorso automaticamente; le
          fasi conclusive chiudono la candidatura.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <caption className="sr-only">Fasi della selezione</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-4">Ordine</TableHead>
                <TableHead>Fase</TableHead>
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
                  <TableCell>{stage.isTerminal ? "Sì" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DetailSection>

      <DetailSection title="Sistema" icon={Database}>
        <DetailList>
          <DetailField label="Archivio">Candidati, candidature e attività del team HR</DetailField>
          <DetailField label="ADV Core">
            Importazione in sola lettura. Le modifiche effettuate da HR vengono conservate durante la sincronizzazione.
          </DetailField>
          <DetailField label="Candidati compatibili">
            Suggerimenti basati su profili, esperienze e CV rispetto alla posizione. La valutazione finale spetta a HR.
          </DetailField>
          <DetailField label="Tema">Selezionabile dall&apos;icona nell&apos;intestazione</DetailField>
        </DetailList>
      </DetailSection>
    </div>
  );
}
