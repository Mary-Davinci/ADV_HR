import { Building2, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { UrlFilterBar } from "@/components/common/url-filter-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyFormButton } from "@/features/companies/components/company-forms";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { EMPTY_VALUE, formatTimeAgo } from "@/lib/format";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Aziende" };

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const filtersSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(100).optional()).catch(undefined),
  region: z.preprocess(first, z.string().trim().max(60).optional()).catch(undefined),
  open: z.preprocess(first, z.enum(["yes"]).optional()).catch(undefined),
});

export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const user = await requirePermission("company.read");
  const filters = filtersSchema.parse(await searchParams);
  const services = await getServices();
  const result = await services.companies.list({
    text: filters.q,
    region: filters.region,
    withOpenSelections: filters.open === "yes",
    limit: 100,
  });
  const regions = ["Lombardia", "Emilia-Romagna", "Piemonte", "Veneto", "Liguria", "Toscana", "Lazio", "Campania"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aziende"
        description="Aziende clienti e relative selezioni."
        actions={can(user, "company.manage") ? <CompanyFormButton /> : undefined}
      />
      <UrlFilterBar
        searchLabel="Cerca aziende per nome, città, partita IVA o settore"
        searchPlaceholder="Nome, città, P.IVA, settore…"
        selects={[
          {
            param: "region",
            label: "Filtra per regione",
            allLabel: "Tutte le regioni",
            options: regions.map((region) => ({ value: region, label: region })),
          },
          {
            param: "open",
            label: "Filtra per selezioni aperte",
            allLabel: "Tutte le aziende",
            options: [{ value: "yes", label: "Solo con selezioni aperte" }],
          },
        ]}
      />

      {result.items.length === 0 ? (
        filters.q || filters.region || filters.open ? (
          <EmptyState icon={SearchX} title="Nessuna azienda trovata" description="Modifica la ricerca o i filtri." />
        ) : (
          <EmptyState icon={Building2} title="Nessuna azienda" description="Crea la prima azienda cliente." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <caption className="sr-only">Elenco aziende</caption>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Azienda</TableHead>
                <TableHead className="hidden md:table-cell">Settore</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Selezioni aperte</TableHead>
                <TableHead className="hidden pr-4 lg:table-cell">Ultimo aggiornamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map(({ company, openSelections, totalSelections }) => (
                <TableRow key={company.id} className="relative focus-within:bg-muted/50">
                  <TableCell className="py-3 pl-4">
                    <Link
                      href={`/companies/${company.id}`}
                      className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {company.name}
                    </Link>
                    {company.vatNumber && <p className="text-xs text-muted-foreground">P.IVA {company.vatNumber}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{company.sector ?? EMPTY_VALUE}</TableCell>
                  <TableCell>
                    {[company.city, company.province && `(${company.province})`].filter(Boolean).join(" ") ||
                      EMPTY_VALUE}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {openSelections}
                    <span className="text-muted-foreground"> / {totalSelections}</span>
                  </TableCell>
                  <TableCell className="hidden pr-4 text-muted-foreground lg:table-cell">
                    {formatTimeAgo(company.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
