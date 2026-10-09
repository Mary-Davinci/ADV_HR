# Bridge ADV CORE — architettura futura

> **Solo architettura.** In V1 non esiste alcuna connessione a ADV CORE: nessun driver MySQL,
> nessuna credenziale, nessun dump, nessun dato reale importato, nessuna scrittura.

## Obiettivo

Rendere disponibili in ADV_HR i dati storici di ADV CORE (candidati/iscritti, aziende, utenti,
documenti) **in sola lettura**, senza che pagine, componenti o servizi di ADV_HR cambino.

```
ADV CORE MySQL
      ↓  (read-only, utente DB con soli privilegi SELECT)
AdvCoreLegacyAdapter        src/repositories/adv-core/   (futuro)
      ↓  mapping schema legacy → domain model ADV_HR
Repository interfaces       src/repositories/types.ts
      ↓
Services / Domain
      ↓
UI (invariata)
```

## Punto di innesto

`src/repositories/index.ts` sceglie l'implementazione con `DATA_SOURCE`:

| Valore     | Stato                             |
| ---------- | --------------------------------- |
| `postgres` | implementato (default)            |
| `adv_core` | **documentato, non implementato** |

Più probabilmente l'adapter sarà **composito**: letture anagrafiche da ADV CORE + dati di
processo (candidature, valutazioni, feedback, colloqui, task, audit) dal database ADV_HR,
perché ADV CORE resta read-only.

## Regole per l'adapter

1. Tutto il codice MySQL, i nomi di tabelle/colonne legacy e il mapping restano **dentro**
   `src/repositories/adv-core/`.
2. Gli stati legacy vengono tradotti negli enum/stage di ADV_HR nell'adapter, mai in UI.
3. Le corrispondenze tra identificativi vanno in `legacy_mappings`
   (`entity_type`, `adv_hr_id`, `legacy_system = ADV_CORE`, `legacy_id`), già presente.
4. I record importati avranno `source = ADV_CORE` (`companies.source`,
   `applications.source`, già previsti negli enum).
5. Connessione con utente MySQL a **sola lettura**; credenziali solo in variabili d'ambiente
   server-side.
6. Nessuna scrittura su ADV CORE.

## Decisioni aperte

- Sincronizzazione (on-demand, batch notturno, CDC) e gestione dei conflitti.
- Deduplicazione dei candidati presenti in entrambi i sistemi (codice fiscale, email).
- Documenti: accesso ai file legacy (percorsi, permessi) e mappatura dei tipi.
- Autenticazione: SSO aziendale oppure utenti ADV_HR con mapping sugli utenti legacy.
- Minimizzazione dei dati: importare solo ciò che serve alla selezione (GDPR).
