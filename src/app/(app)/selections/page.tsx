import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import { z } from "zod";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { UrlFilterBar } from "@/components/common/url-filter-bar";
import { optionsOf, SELECTION_STATUS_LABELS } from "@/config/labels";
import { SELECTION_STATUSES } from "@/domain";
import { SelectionFormButton } from "@/features/companies/components/company-forms";
import { SelectionTable } from "@/features/companies/components/selection-table";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Selezioni" };

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const filtersSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(100).optional()).catch(undefined),
  status: z.preprocess(first, z.enum(SELECTION_STATUSES).optional()).catch(undefined),
});

export default async function SelectionsPage({ searchParams }: PageProps<"/selections">) {
  const user = await requirePermission("selection.read");
  const filters = filtersSchema.parse(await searchParams);
  const services = await getServices();
  const [result, companies] = await Promise.all([
    services.selections.list({ text: filters.q, statuses: filters.status ? [filters.status] : undefined, limit: 100 }),
    can(user, "selection.manage") ? services.companies.options() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Selezioni"
        description="Tutte le selezioni aziendali, con candidati e colloqui."
        actions={
          can(user, "selection.manage") && companies.length > 0 ? (
            <SelectionFormButton companies={companies} />
          ) : undefined
        }
      />
      <UrlFilterBar
        searchLabel="Cerca selezioni per titolo o azienda"
        searchPlaceholder="Titolo o azienda…"
        selects={[
          {
            param: "status",
            label: "Filtra per stato",
            allLabel: "Tutti gli stati",
            options: optionsOf(SELECTION_STATUS_LABELS),
          },
        ]}
      />
      {result.items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nessuna selezione trovata"
          description="Modifica i filtri o crea una nuova selezione."
        />
      ) : (
        <SelectionTable items={result.items} />
      )}
    </div>
  );
}
