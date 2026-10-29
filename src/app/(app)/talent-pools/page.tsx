import { FEATURES } from "@/config/features";
import { notFound } from "next/navigation";
import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreateTalentPoolButton } from "@/features/talent-pools/components/talent-pool-forms";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Talent pool" };

export default async function TalentPoolsPage() {
  if (!FEATURES.talentPools) notFound();
  const user = await requirePermission("talentPool.read");
  const pools = await (await getServices()).talentPools.list();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Talent pool"
        description="Gruppi di profili da tenere in evidenza per selezioni future. Nessun abbinamento automatico: la scelta resta a HR."
        actions={can(user, "talentPool.manage") ? <CreateTalentPoolButton /> : undefined}
      />
      {pools.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Nessun talent pool"
          description="Crea un talent pool per raccogliere profili interessanti."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pools.map((pool) => (
            <li key={pool.id}>
              <Card className="relative h-full transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/30">
                <CardHeader>
                  <Link
                    href={`/talent-pools/${pool.id}`}
                    className="font-medium outline-none after:absolute after:inset-0"
                  >
                    {pool.name}
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pool.description && <p className="text-sm text-muted-foreground">{pool.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">{pool.memberCount}</span> candidati ·
                    creato il {formatDate(pool.createdAt)}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
