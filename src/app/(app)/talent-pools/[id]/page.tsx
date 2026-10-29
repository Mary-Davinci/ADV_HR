import { FEATURES } from "@/config/features";
import { ArrowLeft, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/common/button-link";
import { EmptyState } from "@/components/common/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddPoolMemberButton, RemovePoolMemberButton } from "@/features/talent-pools/components/talent-pool-forms";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { EMPTY_VALUE, formatDate } from "@/lib/format";
import { getServices } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";

async function load(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  return (await getServices()).talentPools.getDetail(id);
}

export async function generateMetadata({ params }: PageProps<"/talent-pools/[id]">): Promise<Metadata> {
  const detail = await load((await params).id);
  return { title: detail?.pool.name ?? "Talent pool non trovato" };
}

export default async function TalentPoolPage({ params }: PageProps<"/talent-pools/[id]">) {
  if (!FEATURES.talentPools) notFound();
  const user = await requirePermission("talentPool.read");
  const detail = await load((await params).id);
  if (!detail) notFound();
  const { pool, members } = detail;
  const canManage = can(user, "talentPool.manage");

  return (
    <div className="space-y-6">
      <ButtonLink variant="ghost" size="sm" className="-ml-2 text-muted-foreground" href="/talent-pools">
        <ArrowLeft aria-hidden="true" />
        Talent pool
      </ButtonLink>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{pool.name}</h1>
          {pool.description && <p className="max-w-2xl text-sm text-muted-foreground">{pool.description}</p>}
          <p className="text-sm text-muted-foreground">{members.length} candidati</p>
        </div>
        {canManage && <AddPoolMemberButton poolId={pool.id} memberIds={members.map((member) => member.candidateId)} />}
      </header>

      {members.length === 0 ? (
        <EmptyState icon={UsersRound} title="Nessun candidato" description="Aggiungi candidati a questo talent pool." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <caption className="sr-only">Membri del talent pool</caption>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Candidato</TableHead>
                <TableHead>Città</TableHead>
                <TableHead>Aggiunto il</TableHead>
                {canManage && (
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Azioni</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.candidateId}>
                  <TableCell className="py-3 pl-4">
                    <Link href={`/recruiting/${member.candidateId}`} className="font-medium hover:underline">
                      {member.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>{member.city ?? EMPTY_VALUE}</TableCell>
                  <TableCell>{formatDate(member.addedAt)}</TableCell>
                  {canManage && (
                    <TableCell className="pr-4 text-right">
                      <RemovePoolMemberButton
                        poolId={pool.id}
                        candidateId={member.candidateId}
                        name={member.fullName}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
