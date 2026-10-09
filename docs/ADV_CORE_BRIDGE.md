# Bridge ADV CORE — sincronizzazione in sola lettura

ADV_HR importa da ADV CORE candidati, aziende e CV **due volte al giorno**. ADV CORE non riceve
mai scritture: tutte le modifiche si fanno in ADV_HR.

```
ADV CORE (produzione)                            ADV_HR (PC ufficio)
  /api/v1/*.php  ◀── HTTPS + chiave API ───  worker  npm run sync:adv-core
  viste MySQL api_v1_* (solo SELECT)           │  lun-ven 13:20 e 18:20 (Utilità di pianificazione)
  accesso solo da IP ufficio                   ▼
                                             PostgreSQL: candidates, companies, documents, ...
                                             + legacy_mappings, adv_core_records, adv_core_sync_runs
```

## Perché un import e non un adapter "live"

L'architettura iniziale prevedeva un adapter che leggesse MySQL a ogni richiesta. Si è scelto
un import pianificato perché:

- ADV CORE è in produzione su Internet, ADV_HR gira in locale: niente connessioni MySQL esposte,
  solo un'API HTTPS in sola lettura con chiave e IP autorizzato;
- i dati importati diventano dati ADV_HR a tutti gli effetti: ricerca, matching, pipeline e UI
  funzionano senza modifiche e i recruiter possono correggerli;
- ADV CORE resta leggibile anche quando è lento o irraggiungibile.

`DATA_SOURCE` resta `postgres`.

## Pianificazione

Il lavoro in azienda è 9-13 e 14-18: la sincronizzazione parte **lun-ven alle 13:20 e alle
18:20**, a dati del turno ormai inseriti.

```powershell
# una volta, sul PC dove gira ADV_HR (con .env.local compilato e PostgreSQL avviato)
powershell -ExecutionPolicy Bypass -File scripts\windows\registra-sync-adv-core.ps1
# per toglierla
powershell -ExecutionPolicy Bypass -File scripts\windows\registra-sync-adv-core.ps1 -Rimuovi
```

- Se il PC è spento all'orario previsto, la sincronizzazione parte appena possibile.
- Gli orari sono salvati in ora locale: non si spostano con l'ora legale/solare.
- Un lock PostgreSQL impedisce due esecuzioni contemporanee (codice di uscita 3).
- Esecuzione manuale: `npm run sync:adv-core`.

## Configurazione (`.env.local`)

| Variabile                 | Note                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `ADV_CORE_API_URL`        | indirizzo del gestionale, `https://` obbligatorio (http solo per host locali) |
| `ADV_CORE_API_KEY`        | chiave consegnata dall'amministratore ADV CORE; segreta                       |
| `ADV_CORE_SYNC_DOCUMENTS` | `true`/`false`, scarica i CV                                                  |
| `ADV_CORE_SYNC_LOG_DIR`   | log mensili, default `./storage/logs`                                         |
| `DOCUMENT_STORAGE_DIR`    | stesso storage dei documenti caricati in ADV_HR                               |

## Come funziona un'esecuzione

1. `stato.php` dà i totali; poi si scaricano **tutte** le aziende e **tutti** i candidati (pagine da
   500). Il download completo è voluto: in ADV CORE la data di ultima modifica non viene
   aggiornata in tutti i flussi, quindi un sync incrementale perderebbe modifiche.
2. Record con payload identico all'esecuzione precedente: saltati (seconda esecuzione ~5 s).
3. Record nuovi o cambiati: mapping + merge a tre vie, una transazione per record. Un errore su
   un record non blocca gli altri (esito `PARTIAL`).
4. CV: scaricati solo se nuovi o se dimensione/data del file sono cambiate.
5. Se i totali ricevuti coincidono con `stato.php`, i record non più presenti vengono segnalati.

Prova con i dati reali del DB locale (5.595 candidati, 1.824 aziende): prima esecuzione 44 s
senza errori, seconda 5 s.

## Regola sui conflitti (concordata)

Per ogni campo si confrontano: valore in ADV_HR, valore scritto all'ultima importazione, valore
attuale in ADV CORE.

| Situazione                                                 | Risultato                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Campo mai modificato in ADV_HR                             | segue ADV CORE                                                                          |
| Modificato in ADV_HR, invariato in ADV CORE                | resta il valore ADV_HR                                                                  |
| Modificato in entrambi                                     | **resta il valore ADV_HR** e il campo è segnalato come conflitto                        |
| ADV_HR adotta il valore ADV CORE                           | il conflitto si chiude                                                                  |
| Candidato/azienda già presente in ADV_HR (stesso CF/P.IVA) | collegato, non duplicato: si riempiono solo i campi vuoti, le differenze sono conflitti |

I conflitti sono in `adv_core_records.conflicts` (`{ campo: { hr, advCore } }`).

## Segnalazioni visibili in ADV_HR (tag del candidato)

| Tag                      | Significato                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `ADV Core`               | candidato importato da ADV CORE                                                          |
| `ADV Core: dati diversi` | almeno un campo in conflitto                                                             |
| `ADV Core: CF duplicato` | ADV CORE ha più iscritti con lo stesso codice fiscale: importato senza CF, da verificare |
| `ADV Core: rimosso`      | cancellato in ADV CORE o non più restituito dall'API: **non** viene cancellato da ADV_HR |

Le aziende hanno `source = ADV_CORE`; P.IVA duplicate e rimozioni sono in `adv_core_records.flags` /
`removed_reason`.

## Mapping

Codice in `src/repositories/adv-core/mapping.ts` (funzioni pure, testate).

| ADV CORE                                                                                                                                                          | ADV_HR                                         | Note                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `nome`, `cognome`                                                                                                                                                 | `candidates.first_name`, `last_name`           | vuoti → `N/D`                                                           |
| `codice_fiscale`                                                                                                                                                  | `candidates.fiscal_code`                       | solo se 16 caratteri validi                                             |
| `email`                                                                                                                                                           | `candidates.email`                             | minuscolo, solo se valida                                               |
| `cellulare` / `telefono` / `telefono_2`                                                                                                                           | `candidates.phone`                             | il primo presente                                                       |
| `nato_il`                                                                                                                                                         | `candidates.birth_date`                        | date impossibili o future scartate                                      |
| `sesso` (Uomo/Donna)                                                                                                                                              | `candidates.gender`                            | altrimenti `NOT_SPECIFIED`                                              |
| `indirizzo`, `comune`, `provincia_sigla`, `regione`                                                                                                               | `candidate_profiles.residence_*`               | regione in formato leggibile                                            |
| `stato_occupazionale`                                                                                                                                             | `employment_status`                            | Disoccupato/Naspi/RDC/Inoccupato → `UNEMPLOYED`, NEET → `INACTIVE`, ... |
| `profilo_professionale`                                                                                                                                           | `professional_summary`                         |                                                                         |
| `tipologia_contrattuale`, `modalita_lavoro`                                                                                                                       | `candidate_preferences.desired_work_time/mode` |                                                                         |
| `disponibilita_trasferimento/trasferte`                                                                                                                           | `willing_to_relocate/travel`                   | SI/NO                                                                   |
| `titolo_studio`                                                                                                                                                   | `candidate_education`                          | solo alla prima importazione                                            |
| `dati_protetti`                                                                                                                                                   | `protected_category_notes`                     | solo se ADV CORE li espone (decisione legale)                           |
| CV (`cv[]`)                                                                                                                                                       | `documents` tipo `CV`                          | formati non gestiti (es. `.p7m`) saltati e annotati                     |
| `denominazione`, `partita_iva`, `codice_fiscale`, `codice_ateco`, `comune`, `provincia_sigla`, `regione`, `email`/`pec`, `telefono`, `informazioni`+`annotazioni` | `companies.*`                                  | `source = ADV_CORE`                                                     |

Tutto il payload ricevuto resta in `adv_core_records.payload` (campi non ancora mappati come
competenze testuali, patente, note di colloquio, sedi operative delle aziende).

## Tabelle

- `legacy_mappings`: collegamento ufficiale id ADV CORE ↔ id ADV_HR (già esistente).
- `adv_core_records`: per ogni record ADV CORE hash del payload, ultimo payload, valori importati
  (base del merge), conflitti, segnalazioni, rimozione.
- `adv_core_sync_runs`: ogni esecuzione con esito, conteggi (mai dati personali) ed errore.

```sql
SELECT started_at, status, stats, error_message FROM adv_core_sync_runs ORDER BY started_at DESC LIMIT 10;
```

## Regole (invariate)

1. Codice legacy, nomi di campi ADV CORE e mapping restano in `src/repositories/adv-core/`.
2. Gli stati legacy diventano enum ADV_HR nel mapping, mai in UI.
3. Corrispondenze in `legacy_mappings`.
4. Nessuna scrittura su ADV CORE; credenziali solo in variabili d'ambiente.
5. Nei log solo conteggi e id ADV CORE.

## Prossimi passi possibili

- Pagina in ADV_HR con lo stato dell'ultima sincronizzazione e l'elenco dei conflitti da risolvere.
- Mapping strutturato di patente, lingue e competenze (oggi testo libero in ADV CORE).
- Sedi operative delle aziende (oggi solo nel payload).
