import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/common/button-link";
import { JobRequestActions } from "@/features/job-requests/components/job-request-actions";
import { JobRequestForm } from "@/features/job-requests/components/job-request-form";
import { JobRequestStatusBadge } from "@/features/job-requests/components/job-request-list";
import { SuggestedCandidates } from "@/features/job-requests/components/suggested-candidates";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getServices } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";

async function load(companyId: string, requestId: string) {
  if (!uuidSchema.safeParse(requestId).success) return null;
  const detail = await (await getServices()).jobRequests.getDetail(requestId);
  return detail && detail.company.id === companyId ? detail : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/companies/[id]/requests/[requestId]">): Promise<Metadata> {
  const { id, requestId } = await params;
  const detail = await load(id, requestId);
  return { title: detail ? `Richiesta ${detail.request.code}` : "Richiesta non trovata" };
}

export default async function JobRequestPage({ params }: PageProps<"/companies/[id]/requests/[requestId]">) {
  const user = await requirePermission("selection.read");
  const { id, requestId } = await params;
  const detail = await load(id, requestId);
  if (!detail) notFound();
  const { request, company, signedDocument } = detail;
  const canManage = can(user, "selection.manage");
  const suggestions =
    request.validatedForm && can(user, "candidate.read")
      ? await (await getServices()).jobRequests.suggestions(request.id)
      : null;

  return (
    <div className="space-y-6">
      <ButtonLink
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        href={`/companies/${company.id}?tab=requests`}
      >
        <ArrowLeft aria-hidden="true" />
        {company.name}
      </ButtonLink>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Richiesta di personale {request.code}</h1>
          <JobRequestStatusBadge status={request.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Revisione {request.revision} · creata il {formatDateTime(request.createdAt)}
          {request.createdBy && ` da ${request.createdBy.displayName}`}
          {request.approvedBy &&
            request.approvedAt &&
            ` · approvata il ${formatDateTime(request.approvedAt)} da ${request.approvedBy.displayName}`}
        </p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 min-w-0 space-y-6 xl:order-1">
          {suggestions && (
            <SuggestedCandidates
              criteria={suggestions.criteria}
              total={suggestions.total}
              items={suggestions.items}
              selectionId={request.selectionId}
              canAdd={can(user, "application.manage")}
            />
          )}
          <JobRequestForm
            key={`${request.id}-${request.revision}-${request.status}`}
            requestId={request.id}
            initialValues={request.form}
            editable={canManage && request.status === "DRAFT"}
          />
        </div>
        <div className="order-1 xl:sticky xl:top-20 xl:order-2">
          <JobRequestActions
            request={request}
            signedDocument={signedDocument ? { id: signedDocument.id, filename: signedDocument.filename } : null}
            canManage={canManage}
            suggestedEmail={request.form.company.contactEmail || company.email || ""}
          />
        </div>
      </div>
    </div>
  );
}
