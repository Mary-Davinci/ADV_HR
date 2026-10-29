/**
 * Funzioni attivabili. Una funzione disattivata resta nel codice e nel database
 * (nessun dato viene cancellato) ma scompare da menu e pagine.
 */
export const FEATURES = {
  /** Talent pool: elenchi di candidati salvati. Nascosto finché non serve (richiesta HR, ottobre 2026). */
  talentPools: false,
} as const;
