"use client";

import { UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FilterSelect } from "@/components/common/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { removePoolMemberAction, addPoolMemberAction } from "@/features/tasks/server/actions";
import { useActionMutation } from "@/hooks/use-action-mutation";

/** Talent pool del candidato: consultazione, aggiunta e rimozione. */
export function PoolMembership({
  candidateId,
  memberOf,
  pools,
  canManage,
}: {
  candidateId: string;
  memberOf: Array<{ id: string; name: string }>;
  pools: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const [poolId, setPoolId] = useState<string | undefined>();
  const add = useActionMutation(addPoolMemberAction, {
    successMessage: (added: boolean) => (added ? "Aggiunto al talent pool" : "Già presente nel talent pool"),
    onSuccess: () => setPoolId(undefined),
  });
  const remove = useActionMutation(removePoolMemberAction, { successMessage: "Rimosso dal talent pool" });
  const available = pools.filter((pool) => !memberOf.some((member) => member.id === pool.id));

  return (
    <div className="space-y-3">
      {memberOf.length === 0 ? (
        <p className="text-sm text-muted-foreground">Non appartiene a nessun talent pool.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {memberOf.map((pool) => (
            <li key={pool.id}>
              <Badge variant="outline" className="h-7 gap-1.5 pr-1 pl-2.5">
                <UsersRound aria-hidden="true" />
                <Link href={`/talent-pools/${pool.id}`} className="hover:underline">
                  {pool.name}
                </Link>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Rimuovi da ${pool.name}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ poolId: pool.id, candidateId })}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {canManage && available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Talent pool a cui aggiungere il candidato"
            allLabel="Scegli un talent pool…"
            value={poolId}
            options={available.map((pool) => ({ value: pool.id, label: pool.name }))}
            onChange={setPoolId}
            className="sm:min-w-56"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!poolId || add.isPending}
            onClick={() => poolId && add.mutate({ poolId, candidateId })}
          >
            Aggiungi
          </Button>
        </div>
      )}
    </div>
  );
}
