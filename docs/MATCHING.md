# Matching candidati ↔ selezioni (architettura)

> Stato V1: **predisposto, non attivo**. Nessun embedding generato, nessuna API esterna
> (OpenAI, Gemini, Qwen, LinkedIn, Indeed…) chiamata, nessun matching mostrato in UI.

## Principi

1. **Nessun ranking definitivo automatico**, nessun "candidato perfetto".
2. **Spiegabilità**: ogni requisito ha un esito `PASS`, `FAIL`, `UNKNOWN` o `REVIEW_REQUIRED`
   con un messaggio leggibile da HR.
3. **Un dato mancante non è un FAIL**: diventa `UNKNOWN`, da verificare con il candidato.
4. **La decisione finale resta a HR.**

Esiti complessivi, con formulazione prudente: _Profilo suggerito_, _Profilo coerente_,
_Compatibilità parziale_, _Da verificare_, _Requisiti non soddisfatti_.

Esempio di presentazione:

```
✓ Java
✓ 4 anni di esperienza
? Disponibilità immediata non dichiarata
✕ Sede richiesta incompatibile
```

## Motore ibrido

```
Hard filters  →  Similarità semantica  →  Revisione umana
(regole)         (pgvector, futuro)        (HR)
```

### Hard filters (pronti)

`src/services/matching/hard-filters.ts`: valutatori puri e testati per LOCATION, RELOCATION,
WORK_MODE, WORK_TIME, DRIVING_LICENSE, PROTECTED_CATEGORY, EDUCATION, LANGUAGE,
CERTIFICATION, EXPERIENCE e SKILL. L'esito complessivo si ottiene con `deriveOverallStatus`
(`src/domain/matching.ts`), senza pesi nascosti:

- un requisito **obbligatorio** in FAIL → _Requisiti non soddisfatti_
- dati mancanti o da verificare → _Da verificare_
- FAIL solo su requisiti facoltativi → _Compatibilità parziale_
- tutto PASS → _Profilo coerente_

### Semantica (predisposta)

- Tabelle `candidate_embeddings` e `job_description_embeddings`: `vector(1024)`, modello,
  `content_hash`, indice HNSW coseno.
- `buildCandidateEmbeddingText()` costruisce il testo dal profilo professionale (sintesi,
  esperienze, competenze, formazione, interessi) **escludendo dati identificativi**: nome,
  codice fiscale, contatti, data di nascita, L. 68/99.
- `content_hash` (SHA-256) evita di ricalcolare embedding invariati.
- Contratti `EmbeddingProvider` e `SemanticSimilarityProvider` in `src/services/matching/contracts.ts`.

Dimensione 1024: pensata per modelli multilingue. Un modello con dimensione diversa
richiede una migration dedicata.

### Persistenza (predisposta)

`matching_runs` (selezione, versione del motore, autore) → `matching_results` (candidato,
esito complessivo) → `matching_evidence` (requisito, stato, messaggio, metadata).
Ogni esecuzione è storicizzata e verificabile.

## Prossimi passi (fuori da V1)

1. Definizione dei requisiti strutturati nella job description.
2. Scelta del modello di embedding (preferibilmente locale o approvato dall'organizzazione) e job di calcolo.
3. `MatchingService` che esegue hard filters + similarità e salva run/risultati/evidenze.
4. Vista "Profili suggeriti" nella selezione, con le evidenze sempre visibili e azioni solo manuali.
