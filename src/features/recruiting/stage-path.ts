import type { RecruitingStage } from "@/domain";

export interface StagePath {
  /** Fasi del percorso, in ordine: attive, non finali, prima del primo esito finale. */
  steps: RecruitingStage[];
  /** Posizione della fase attuale nel percorso; -1 se è un esito finale o una fase fuori percorso. */
  currentIndex: number;
  /** Esito finale raggiunto (es. Selezionato, Scartato). */
  outcome: RecruitingStage | null;
  /** Fase attiva fuori dal percorso (es. In attesa). */
  aside: RecruitingStage | null;
  /** Fase successiva del percorso, se ce n'è una. */
  next: RecruitingStage | null;
}

/**
 * Le fasi sono configurabili (tabella recruiting_stages): il percorso si ricava da posizione e
 * flag, senza codici scritti nel codice. Le fasi dopo il primo esito finale stanno fuori percorso.
 */
export function stagePath(stages: RecruitingStage[], current: RecruitingStage): StagePath {
  const active = stages.filter((stage) => stage.active).sort((a, b) => a.position - b.position);
  const firstOutcome = Math.min(...active.filter((stage) => stage.isTerminal).map((stage) => stage.position));
  const steps = active.filter((stage) => !stage.isTerminal && stage.position < firstOutcome);
  const currentIndex = steps.findIndex((stage) => stage.id === current.id);
  return {
    steps,
    currentIndex,
    outcome: current.isTerminal ? current : null,
    aside: !current.isTerminal && currentIndex === -1 ? current : null,
    next: currentIndex >= 0 ? (steps[currentIndex + 1] ?? null) : null,
  };
}
