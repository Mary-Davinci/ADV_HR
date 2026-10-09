import { endOfDay, format, isValid, parseISO, startOfDay, subDays } from "date-fns";
import type { Metadata } from "next";
import { z } from "zod";

import { CountList } from "@/components/common/count-list";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  APPLICATION_SOURCE_LABELS,
  EVALUATION_RESULT_LABELS,
  INTERVIEW_STATUS_LABELS,
  labelOf,
  SELECTION_STATUS_LABELS,
} from "@/config/labels";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Report" };

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const isoDate = z
  .preprocess(
    first,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  )
  .catch(undefined);
const schema = z.object({ from: isoDate, to: isoDate });

function ReportCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-medium">{title}</h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Report operativi semplici: conteggi chiari, nessuna BI complessa. */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requirePermission("reports.read");
  const params = schema.parse(await searchParams);
  const now = new Date();
  const fromDate = params.from && isValid(parseISO(params.from)) ? parseISO(params.from) : subDays(now, 90);
  const toDate = params.to && isValid(parseISO(params.to)) ? parseISO(params.to) : now;
  const range = { from: startOfDay(fromDate), to: endOfDay(toDate) };

  const report = await (await getServices()).reports.getReport(range);
  const periodLabel = `dal ${formatDate(range.from)} al ${formatDate(range.to)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report"
        description="Andamento della ricerca e selezione. I dati del periodo si basano sulla data di creazione o dell'evento."
      />

      <form action="/reports" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="grid gap-1.5">
          <label htmlFor="report-from" className="text-sm font-medium">
            Dal
          </label>
          <input
            id="report-from"
            type="date"
            name="from"
            defaultValue={format(range.from, "yyyy-MM-dd")}
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="report-to" className="text-sm font-medium">
            Al
          </label>
          <input
            id="report-to"
            type="date"
            name="to"
            defaultValue={format(range.to, "yyyy-MM-dd")}
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
        </div>
        <Button type="submit" variant="outline">
          Aggiorna periodo
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportCard
          title="Candidati per stato"
          description="Stato della candidatura più recente di ciascun candidato (situazione attuale)."
        >
          <CountList
            items={report.candidatesByStage.map((row) => ({ key: row.code, label: row.label, count: row.count }))}
          />
        </ReportCard>
        <ReportCard title="Candidature per stage" description={`Candidature create ${periodLabel}.`}>
          <CountList
            items={report.applicationsByStage.map((row) => ({ key: row.code, label: row.label, count: row.count }))}
          />
        </ReportCard>
        <ReportCard title="Selezioni per stato" description="Situazione attuale di tutte le selezioni.">
          <CountList
            items={report.selectionsByStatus.map((row) => ({
              key: row.status,
              label: labelOf(SELECTION_STATUS_LABELS, row.status as keyof typeof SELECTION_STATUS_LABELS, row.status),
              count: row.count,
            }))}
          />
        </ReportCard>
        <ReportCard title="Colloqui nel periodo" description={`Colloqui con data ${periodLabel}.`}>
          <CountList
            items={report.interviewsByStatus.map((row) => ({
              key: row.status,
              label: labelOf(INTERVIEW_STATUS_LABELS, row.status as keyof typeof INTERVIEW_STATUS_LABELS, row.status),
              count: row.count,
            }))}
          />
        </ReportCard>
        <ReportCard
          title="Idonei / non idonei"
          description={`Ultima valutazione di ogni candidatura, registrata ${periodLabel}.`}
        >
          <CountList
            items={report.evaluations.map((row) => ({
              key: row.result,
              label: labelOf(EVALUATION_RESULT_LABELS, row.result as keyof typeof EVALUATION_RESULT_LABELS, row.result),
              count: row.count,
            }))}
          />
        </ReportCard>
        <ReportCard title="Fonte delle candidature" description={`Candidature create ${periodLabel}.`}>
          <CountList
            items={report.applicationsBySource.map((row) => ({
              key: row.source,
              label: labelOf(
                APPLICATION_SOURCE_LABELS,
                row.source as keyof typeof APPLICATION_SOURCE_LABELS,
                row.source,
              ),
              count: row.count,
            }))}
          />
        </ReportCard>
      </div>
    </div>
  );
}
