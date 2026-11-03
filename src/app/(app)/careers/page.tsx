import { CircleCheck, CircleSlash, EyeOff, FilePenLine, Globe, TimerOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CareerBoard } from "@/domain/careers";
import { requirePermission } from "@/lib/auth/session";
import { EMPTY_VALUE, formatDate, formatTimeAgo } from "@/lib/format";
import { getCareers } from "@/lib/server/careers";

export const metadata: Metadata = { title: "Annunci sito" };

const BOARD_LABELS: Record<CareerBoard, string> = { aziende: "Offerte delle aziende", Careers: "Lavora con noi" };
const STATE_PRESENTATION = {
  DRAFT: { label: "Bozza", tone: "neutral", icon: FilePenLine },
  PUBLISHED: { label: "Pubblicato", tone: "success", icon: CircleCheck },
  HIDDEN: { label: "Nascosto: selezione non aperta", tone: "warning", icon: EyeOff },
  EXPIRED: { label: "Scaduto", tone: "danger", icon: TimerOff },
} satisfies Record<string, { label: string; tone: StatusTone; icon: typeof Globe }>;

/** Vista d'insieme degli annunci del sito candidature: si modificano dalla scheda «Sito pubblico» della selezione. */
export default async function CareersPage() {
  const user = await requirePermission("selection.read");
  const { portalEnabled, items } = await getCareers().overview(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Annunci sito"
        description="Gli annunci del sito candidature di Accademia Da Vinci. Per creare un annuncio apri una selezione aperta e usa la scheda «Sito pubblico»."
        actions={
          <>
            <ButtonLink variant="outline" href="/recruiting?origin=WEBSITE">
              Candidati dal sito
            </ButtonLink>
            <ButtonLink href="/selections?status=OPEN">Nuovo annuncio da una selezione</ButtonLink>
          </>
        }
      />

      {!portalEnabled && (
        <Alert>
          <CircleSlash aria-hidden="true" />
          <AlertTitle>Sito candidature non ancora online</AlertTitle>
          <AlertDescription>
            Puoi preparare e pubblicare gli annunci: diventeranno visibili ai candidati quando il portale verrà
            attivato.
          </AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Nessun annuncio"
          description="Apri una selezione e compila la scheda «Sito pubblico» per preparare il primo annuncio."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <caption className="sr-only">Annunci del sito candidature</caption>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Annuncio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="hidden md:table-cell">Sezione</TableHead>
                <TableHead className="text-right">Candidature</TableHead>
                <TableHead className="hidden lg:table-cell">Scadenza</TableHead>
                <TableHead className="hidden pr-4 xl:table-cell">Aggiornato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const state = STATE_PRESENTATION[item.state];
                return (
                  <TableRow key={item.selectionId} className="relative focus-within:bg-muted/50">
                    <TableCell className="py-3 pl-4">
                      <Link
                        href={`/companies/${item.companyId}/selections/${item.selectionId}?tab=publication`}
                        className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.companyName}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={state.label} tone={state.tone} icon={state.icon} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{BOARD_LABELS[item.board]}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.submissions}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {item.expiresAt ? formatDate(item.expiresAt) : EMPTY_VALUE}
                    </TableCell>
                    <TableCell className="hidden pr-4 text-muted-foreground xl:table-cell">
                      {formatTimeAgo(item.updatedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
