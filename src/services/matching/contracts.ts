import type { EntityId, JobDescription, MatchingEvidence, MatchingRequirement, MatchingResult } from "@/domain";
import type { CandidateAggregate } from "@/repositories/types";

/**
 * Architettura del futuro motore di matching ibrido (vedi docs/MATCHING.md):
 *
 *   1. Hard filters        → regole esplicite e spiegabili (HardFilterEvaluator)
 *   2. Similarità semantica → pgvector su embedding (SemanticSimilarityProvider)
 *   3. Revisione umana      → HR decide sempre; il sistema suggerisce e spiega
 *
 * In V1 NESSUN embedding viene generato e nessuna API esterna è chiamata.
 */

/** Valuta un singolo requisito su un profilo. Deve essere puro e deterministico. */
export interface HardFilterEvaluator {
  evaluate(candidate: CandidateAggregate, requirement: MatchingRequirement): MatchingEvidence;
}

/** Fornitore di embedding (futuro: modello locale o servizio approvato). NON implementato. */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

/** Similarità tra profilo e job description tramite pgvector. NON implementato. */
export interface SemanticSimilarityProvider {
  similarity(candidateId: EntityId, jobDescription: Pick<JobDescription, "id">): Promise<number | null>;
}

export interface MatchingService {
  /**
   * Valuta i candidati indicati rispetto ai requisiti della selezione e salva
   * run/risultati/evidenze. Restituisce risultati spiegabili, NON una classifica.
   */
  evaluate(input: {
    selectionId: EntityId;
    candidateIds: EntityId[];
    requirements: MatchingRequirement[];
  }): Promise<MatchingResult[]>;
}

export const MATCHING_ENGINE_VERSION = "0.1.0-hard-filters";
