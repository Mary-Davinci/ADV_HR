import { ArrowLeft, Briefcase, Building2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/common/button-link";
import { DetailField, DetailList, DetailSection } from "@/components/common/detail-section";
import { EmptyState } from "@/components/common/empty-state";
import { Timeline } from "@/components/common/timeline";
import { UrlTabs } from "@/components/common/url-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyFormButton, SelectionFormButton } from "@/features/companies/components/company-forms";
import { SelectionTable } from "@/features/companies/components/selection-table";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getServices } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";

async function load(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  return (await getServices()).companies.getDetail(id);
}

export async function generateMetadata({ params }: PageProps<"/companies/[id]">): Promise<Metadata> {
  const detail = await load((await params).id);
  return { title: detail?.company.name ?? "Azienda non trovata" };
}

export default async function CompanyPage({ params, searchParams }: PageProps<"/companies/[id]">) {
  const user = await requirePermission("company.read");
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const detail = await load(id);
  if (!detail) notFound();
  const { company, selections, documents, timeline } = detail;
  const open = selections.filter(({ selection }) => ["OPEN", "PAUSED"].includes(selection.status)).length;

  return (
    <div className="space-y-6">
      <ButtonLink variant="ghost" size="sm" className="-ml-2 text-muted-foreground" href="/companies">
        <ArrowLeft aria-hidden="true" />
        Torna alle aziende
      </ButtonLink>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[company.sector, company.city].filter(Boolean).join(" · ")} · {open} selezioni attive su{" "}
            {selections.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, "company.manage") && <CompanyFormButton company={company} />}
          {can(user, "selection.manage") && <SelectionFormButton companyId={company.id} />}
        </div>
      </header>

      <UrlTabs
        label="Sezioni della scheda azienda"
        defaultValue={typeof tab === "string" ? tab : undefined}
        tabs={[
          {
            value: "selections",
            label: "Selezioni",
            count: selections.length,
            content:
              selections.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="Nessuna selezione"
                  description="Crea una selezione per iniziare la ricerca."
                />
              ) : (
                <SelectionTable items={selections} showCompany={false} />
              ),
          },
          {
            value: "profile",
            label: "Profilo",
            content: (
              <DetailSection title="Dati azienda" icon={Building2}>
                <DetailList className="lg:grid-cols-3">
                  <DetailField label="Ragione sociale">{company.name}</DetailField>
                  <DetailField label="Partita IVA">{company.vatNumber}</DetailField>
                  <DetailField label="Codice fiscale">{company.fiscalCode}</DetailField>
                  <DetailField label="Settore">{company.sector}</DetailField>
                  <DetailField label="Sede">
                    {[company.city, company.province && `(${company.province})`, company.region]
                      .filter(Boolean)
                      .join(" ")}
                  </DetailField>
                  <DetailField label="Email">{company.email}</DetailField>
                  <DetailField label="Telefono">{company.phone}</DetailField>
                  <DetailField label="Aggiornata il">{formatDateTime(company.updatedAt)}</DetailField>
                  <DetailField label="Note" className="sm:col-span-2 lg:col-span-3">
                    {company.notes}
                  </DetailField>
                </DetailList>
              </DetailSection>
            ),
          },
          {
            value: "documents",
            label: "Documenti",
            count: documents.length,
            content: (
              <DocumentsPanel
                owner={{ companyId: company.id }}
                documents={documents}
                allowedTypes={["CONTRACT", "JOB_DESCRIPTION", "OTHER"]}
                canManage={can(user, "document.manage")}
              />
            ),
          },
          {
            value: "timeline",
            label: "Timeline",
            content: (
              <Card>
                <CardContent>
                  <Timeline activities={timeline} />
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
