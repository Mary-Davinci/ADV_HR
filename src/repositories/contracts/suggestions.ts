import type { EducationLevel, EntityId } from "@/domain";

/* ------------------------------------------------------------------ */
/* Candidati suggeriti per una job description                          */
/* ------------------------------------------------------------------ */

export interface CandidateSuggestionQuery {
  province: string;
  keywords: string[];
  /** Selezione già aperta: segnala chi è già candidato. */
  selectionId?: EntityId | null;
  limit?: number;
}

export interface CandidateSuggestion {
  candidateId: EntityId;
  firstName: string;
  lastName: string;
  residenceCity: string | null;
  residenceProvince: string | null;
  sameProvince: boolean;
  sameRegion: boolean;
  /** Regione del luogo di lavoro, dedotta dalla provincia. */
  jobRegion: string | null;
  bestEducationLevel: EducationLevel | null;
  /** Parole chiave trovate nel testo dei CV. */
  matchedKeywords: string[];
  /** CV presente / CV con testo leggibile (le scansioni non sono leggibili). */
  hasCv: boolean;
  hasReadableCv: boolean;
  alreadyInSelection: boolean;
}

export interface CandidateSuggestionRepository {
  /**
   * Candidati attivi (non rimossi da ADV Core) che soddisfano almeno uno tra:
   * stessa provincia, stessa regione, parole chiave nel CV. Ordinati per numero
   * di criteri soddisfatti, poi per pertinenza del CV.
   */
  suggest(query: CandidateSuggestionQuery): Promise<{ total: number; items: CandidateSuggestion[] }>;
}
