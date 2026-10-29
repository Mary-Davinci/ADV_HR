import { Ban, CircleCheck, FilePenLine, FileSignature, PlayCircle, Send, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JOB_REQUEST_STATUS_LABELS } from "@/config/labels";
import type { JobRequest, JobRequestStatus } from "@/domain";
import { EMPTY_VALUE, formatTimeAgo } from "@/lib/format";

const PRESENTATION: Record<JobRequestStatus, { tone: StatusTone; icon: LucideIcon }> = {
  DRAFT: { tone: "neutral", icon: FilePenLine },
  SENT: { tone: "progress", icon: Send },
  READY: { tone: "info", icon: FileSignature },
  SIGNED: { tone: "warning", icon: CircleCheck },
  OPENED: { tone: "success", icon: PlayCircle },
  CANCELLED: { tone: "neutral", icon: Ban },
};

export function JobRequestStatusBadge({ status }: { status: JobRequestStatus }) {
  const { tone, icon } = PRESENTATION[status];
  return <StatusBadge label={JOB_REQUEST_STATUS_LABELS[status]} tone={tone} icon={icon} />;
}

/** Richieste di personale di un'azienda, dalla più recente. */
export function JobRequestList({ companyId, items }: { companyId: string; items: JobRequest[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <caption className="sr-only">Richieste di personale</caption>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-4">Richiesta</TableHead>
            <TableHead>Ruolo</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="hidden text-right md:table-cell">Revisione</TableHead>
            <TableHead className="hidden pr-4 lg:table-cell">Aggiornata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((request) => (
            <TableRow key={request.id} className="relative focus-within:bg-muted/50">
              <TableCell className="py-3 pl-4">
                <Link
                  href={`/companies/${companyId}/requests/${request.id}`}
                  className="font-medium tabular-nums outline-none after:absolute after:inset-0 focus-visible:underline"
                >
                  {request.code}
                </Link>
              </TableCell>
              <TableCell>{request.form.profile.role || EMPTY_VALUE}</TableCell>
              <TableCell>
                <JobRequestStatusBadge status={request.status} />
              </TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{request.revision}</TableCell>
              <TableCell className="hidden pr-4 text-muted-foreground lg:table-cell">
                {formatTimeAgo(request.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
