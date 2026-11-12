import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ButtonLink } from "@/components/common/button-link";
import { MergeCandidatePair } from "@/features/candidates/components/merge-candidate-pair";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getServices } from "@/lib/server/services";

export const metadata: Metadata = { title: "Possibili duplicati" };
export default async function DuplicatesPage() {
  const user = await requirePermission("candidate.read");
  const pairs = await (await getServices()).candidates.duplicatePairs();
  const canMerge = can(user, "candidate.edit") && can(user, "application.manage") && can(user, "document.manage");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Possibili duplicati"
        description="Schede con lo stesso nome, telefono o email. Sono segnalazioni da verificare: un recapito condiviso non prova che sia la stessa persona."
        actions={
          <ButtonLink href="/recruiting" variant="outline">
            Torna ai candidati
          </ButtonLink>
        }
      />
      <p className="text-sm text-muted-foreground">
        {pairs.length
          ? `${pairs.length} coppie da verificare${pairs.length === 200 ? " (prime 200: dopo le unioni verranno mostrate le successive)" : ""}.`
          : "Nessuna coppia sospetta trovata."}
      </p>
      {pairs.map((pair) => (
        <MergeCandidatePair key={`${pair.left.id}-${pair.right.id}`} {...pair} canMerge={canMerge} />
      ))}
    </div>
  );
}
