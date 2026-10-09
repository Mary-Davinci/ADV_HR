import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelectionStatusBadge } from "@/features/recruiting/components/badges";
import { EMPTY_VALUE, formatDate, formatTimeAgo } from "@/lib/format";
import type { SelectionListItem } from "@/repositories/types";

/** Elenco selezioni con contatori sintetici. */
export function SelectionTable({ items, showCompany = true }: { items: SelectionListItem[]; showCompany?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <caption className="sr-only">Selezioni aziendali</caption>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Selezione</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Candidati</TableHead>
            <TableHead className="hidden text-right md:table-cell">Idonei</TableHead>
            <TableHead className="hidden text-right md:table-cell">Da valutare</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Colloqui</TableHead>
            <TableHead className="hidden lg:table-cell">Apertura</TableHead>
            <TableHead className="hidden pr-4 xl:table-cell">Aggiornata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(({ selection, companyName, stats }) => (
            <TableRow key={selection.id} className="relative focus-within:bg-muted/50">
              <TableCell className="py-3 pl-4">
                <Link
                  href={`/companies/${selection.companyId}/selections/${selection.id}`}
                  className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                >
                  {selection.title}
                </Link>
                {showCompany && <p className="text-xs text-muted-foreground">{companyName}</p>}
              </TableCell>
              <TableCell>
                <SelectionStatusBadge status={selection.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{stats.applications}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{stats.suitable}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{stats.toEvaluate}</TableCell>
              <TableCell className="hidden text-right tabular-nums lg:table-cell">
                {stats.scheduledInterviews}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {selection.openedAt ? formatDate(selection.openedAt) : EMPTY_VALUE}
              </TableCell>
              <TableCell className="hidden pr-4 text-muted-foreground xl:table-cell">
                {formatTimeAgo(selection.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
