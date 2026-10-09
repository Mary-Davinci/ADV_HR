import type { EntityId } from "./shared";

/**
 * Contratti del futuro motore di matching ibrido:
 *   Hard filters + Similarità semantica + Revisione umana.
 *
 * Principi (vedi docs/MATCHING.md):
 * - nessun ranking definitivo automatico, nessun "candidato perfetto";
 * - ogni requisito ha un esito spiegabile (PASS / FAIL / UNKNOWN / REVIEW_REQUIRED);
 * - la decisione finale resta sempre a HR.
 */

export const MATCHING_REQUIREMENT_CODES = [
  "LOCATION",
  "RELOCATION",
  "WORK_MODE",
  "WORK_TIME",
  "DRIVING_LICENSE",
  "PROTECTED_CATEGORY",
  "EDUCATION",
  "LANGUAGE",
  "CERTIFICATION",
  "EXPERIENCE",
  "SKILL",
  "SEMANTIC_SIMILARITY",
] as const;
export type MatchingRequirementCode = (typeof MATCHING_REQUIREMENT_CODES)[number];

export const MATCHING_EVIDENCE_STATUSES = ["PASS", "FAIL", "UNKNOWN", "REVIEW_REQUIRED"] as const;
export type MatchingEvidenceStatus = (typeof MATCHING_EVIDENCE_STATUSES)[number];

/**
 * Esito complessivo, formulato in modo prudente. Deliberatamente NON esiste
 * uno stato "perfetto" o un punteggio definitivo.
 */
export const MATCHING_OVERALL_STATUSES = ["SUGGESTED", "COHERENT", "PARTIAL", "TO_VERIFY", "NOT_COMPATIBLE"] as const;
export type MatchingOverallStatus = (typeof MATCHING_OVERALL_STATUSES)[number];

export type MatchingRequirementKind = "HARD_FILTER" | "SEMANTIC";

export interface MatchingRequirement {
  code: MatchingRequirementCode;
  kind: MatchingRequirementKind;
  /** Un requisito obbligatorio in FAIL rende il profilo NOT_COMPATIBLE. */
  mandatory: boolean;
  /** Parametri specifici (es. { skill: "java", minYears: 3 }). */
  params: Record<string, unknown>;
  label: string;
}

export interface MatchingEvidence {
  requirementCode: MatchingRequirementCode;
  status: MatchingEvidenceStatus;
  /** Spiegazione leggibile da HR, es. "Sede richiesta incompatibile". */
  message: string;
  metadata: Record<string, unknown>;
}

export interface MatchingResult {
  candidateId: EntityId;
  overallStatus: MatchingOverallStatus;
  evidence: MatchingEvidence[];
  /** Similarità semantica grezza (0–1), solo informativa. Mai usata come ranking definitivo. */
  semanticSimilarity: number | null;
}

export interface MatchingRunSummary {
  id: EntityId;
  selectionId: EntityId;
  engineVersion: string;
  createdBy: EntityId | null;
  createdAt: Date;
}

/**
 * Regola di aggregazione trasparente: deriva l'esito complessivo dalle
 * evidenze, senza pesi nascosti.
 */
export function deriveOverallStatus(
  evidence: Array<Pick<MatchingEvidence, "status" | "requirementCode">>,
  requirements: Array<Pick<MatchingRequirement, "code" | "mandatory">>,
): MatchingOverallStatus {
  const mandatory = new Set(requirements.filter((r) => r.mandatory).map((r) => r.code));
  if (evidence.some((e) => e.status === "FAIL" && mandatory.has(e.requirementCode))) return "NOT_COMPATIBLE";
  if (evidence.some((e) => e.status === "REVIEW_REQUIRED" || e.status === "UNKNOWN")) return "TO_VERIFY";
  if (evidence.some((e) => e.status === "FAIL")) return "PARTIAL";
  return evidence.length > 0 ? "COHERENT" : "TO_VERIFY";
}
