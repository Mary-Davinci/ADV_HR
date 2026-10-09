# Architettura ADV_HR

ADV_HR è la piattaforma HR di Accademia Da Vinci. È un **sistema autonomo** con un proprio
database PostgreSQL. Il gestionale legacy **ADV CORE** (PHP + MySQL) sarà in futuro una
sorgente esterna **in sola lettura**, collegata tramite un adapter dedicato (non implementato).

Documenti correlati: [DATABASE.md](DATABASE.md) · [MATCHING.md](MATCHING.md) · [ADV_CORE_BRIDGE.md](ADV_CORE_BRIDGE.md)

## Principio guida

> La UI non conosce MySQL, ADV CORE, nomi di colonne legacy o query SQL.
> Il domain model di ADV_HR (`src/domain`) usa nomi propri del business HR.

```
ADV CORE (futuro, read-only)
   ↓
Legacy Adapter (futuro)
   ↓
Repository interfaces  ←  PostgreSQL ADV_HR (oggi)
   ↓
Services / Domain  (regole, RBAC, transazioni, activity, audit)
   ↓
DAL + Server Actions  (sessione, validazione Zod)
   ↓
UI (Server Components + Client Components)
```

## Livelli e cartelle

| Cartella                                   | Responsabilità                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain`                               | Tipi, enum e regole pure (es. motivazione obbligatoria per "non idoneo", durata esperienze, esito matching). Nessuna dipendenza da framework o database. |
| `src/db/schema`                            | Schema Drizzle (tabelle, enum PG, indici, vincoli). Gli enum PG derivano dalle costanti di dominio.                                                      |
| `drizzle/`                                 | Migration SQL versionate.                                                                                                                                |
| `src/repositories/types.ts` + `contracts/` | Contratti dei repository, orientati ai casi d'uso, con filtri nel linguaggio del dominio.                                                                |
| `src/repositories/postgres`                | Implementazione PostgreSQL (Drizzle, query sempre parametrizzate).                                                                                       |
| `src/repositories/index.ts`                | **Composition root**: sceglie l'implementazione in base a `DATA_SOURCE`.                                                                                 |
| `src/services`                             | Casi d'uso: autorizzazione, regole, transazioni, activity e audit.                                                                                       |
| `src/lib/server`                           | DAL applicativo: `getServices()` (utente corrente) e `runAction()` (sessione → Zod → servizio).                                                          |
| `src/features/<area>`                      | UI, schemi Zod e server action per area (candidates, recruiting, companies, interviews, tasks, talent-pools, documents, dashboard).                      |
| `src/config`                               | Label italiane centralizzate e navigazione.                                                                                                              |

## Database ownership

- ADV_HR è **proprietario** del proprio database PostgreSQL: anagrafiche HR, candidature,
  pipeline, colloqui, feedback, task, documenti (metadati), audit.
- Nessun dato di ADV CORE è copiato o sincronizzato in V1. La tabella `legacy_mappings` è
  predisposta per il futuro bridge ma **vuota e inutilizzata**.
- Scelta ORM: **Drizzle** (vedi [DATABASE.md](DATABASE.md#scelta-orm)).

## Repository boundaries

- Ogni repository espone metodi di caso d'uso (`search`, `getAggregate`, `list`, `updateStage`, …),
  non tabelle generiche.
- I **read model** (es. `CandidateListItem`, `ApplicationView`) contengono dati già derivati
  (stage corrente, prossimo colloquio, ultimo contatto): la UI non ricostruisce join.
- `DataStore.transaction(work)` fornisce repository legati a una transazione (unit of work):
  le operazioni che toccano più tabelle sono atomiche.
- Nessun servizio o componente importa Drizzle o SQL: solo `src/repositories/postgres` e `src/db`.

## Autenticazione

- Auth.js v5, sessione JWT (8 ore), provider Credentials su **utenti del database**
  (`users`, password hash scrypt). Nessuna password in chiaro, nessun utente hardcoded.
- `proxy.ts` esegue un controllo **ottimistico** (redirect al login).
- Il DAL (`lib/auth/session.ts`) **ricarica l'utente dal DB a ogni richiesta**: utente
  disattivato o ruoli cambiati hanno effetto immediato.
- Per SSO aziendale (es. Microsoft Entra ID) si aggiunge un provider in `src/auth.ts`.

## RBAC

Permessi centralizzati in `src/lib/auth/permissions.ts`. Il codice chiede `can(user, "permesso")`,
mai `role === ...`.

| Ruolo      | Permessi principali                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN      | tutti                                                                                                                                                         |
| HR_MANAGER | candidati, candidature, valutazioni, colloqui, feedback, selezioni, aziende, documenti, task, talent pool, report                                             |
| RECRUITER  | candidate.read/create/edit, application.manage, evaluation.manage, interview.manage, feedback.manage, lettura selezioni/aziende, documenti, task, talent pool |
| VIEWER     | sola lettura (niente audit/impostazioni)                                                                                                                      |

L'autorizzazione è verificata **nei servizi** (`assertCan`), quindi vale per ogni server action
e route handler. Le pagine usano `requirePermission()` per mostrare `/forbidden`; la UI
nasconde le azioni non consentite solo per chiarezza, non per sicurezza.

## Activity model (timeline)

`activities` registra eventi di business leggibili: creazione, aggiornamenti, cambi di stato,
colloqui, feedback, valutazioni, documenti, task, talent pool e **contatti**.

- `entity_type` + `entity_id`: soggetto dell'evento.
- `candidate_id`, `selection_id`, `company_id`: colonne di **contesto** per ricostruire la
  timeline del candidato o della selezione senza join ricorsivi.
- `metadata` (jsonb): solo dati utili alla visualizzazione (es. stage da/a).

**Ultimo contatto** = `max(created_at)` delle activity con azione di contatto
(`PHONE_CALL`, `EMAIL`, `WHATSAPP`, `INTERVIEW`, `FOLLOW_UP`, `OTHER_CONTACT`). Non esiste un
campo compilabile a mano. Un colloquio segnato "svolto" genera anche un'activity `INTERVIEW`.

**Ultima revisione** (`candidate_profiles.last_reviewed_at`): aggiornata dal service a ogni
modifica rilevante del profilo (anagrafica, profilo, preferenze, collezioni, competenze),
nella stessa transazione dell'aggiornamento. La registrazione di un contatto non conta come revisione.

## Audit model

`audit_logs` è la traccia tecnica delle modifiche (chi, cosa, quando), scritta nella stessa
transazione dell'operazione: modifica candidato, cambio stage, valutazione, feedback, colloquio,
documento, azienda, selezione, task, talent pool.

- `changes` contiene **nomi di campo** e valori non sensibili (es. stage da/a, esito).
- Mai password, token, segreti, contenuti di documenti o testi liberi personali (per una
  valutazione si registra solo `reasonProvided: true`).
- Le letture (SELECT) non sono auditate.
- I log applicativi degli errori riportano solo nome e codice SQLSTATE: Drizzle include
  query e parametri nel messaggio, che quindi non viene mai loggato.

## Transazioni

Ogni operazione "entità + activity + audit" usa `store.transaction(...)`. Esempio cambio stage:

```
BEGIN
  UPDATE applications SET stage_id = …
  INSERT INTO activities (… STATUS_CHANGED …)
  INSERT INTO audit_logs (… STAGE_CHANGE …)
  [se scarto] INSERT INTO application_evaluations (NOT_SUITABLE, motivo)
COMMIT
```

Un'eccezione in qualsiasi passo annulla tutto (test: `services.test.ts`, `postgres-repositories.test.ts`).

## Regole di dominio principali

- La **valutazione** (idoneo / non idoneo / da rivalutare) appartiene alla candidatura, non
  al candidato. Lo storico è conservato.
- **Non idoneo richiede motivazione**: verificato da Zod (client e server), dal dominio
  (`assertValidEvaluation`) e da un CHECK constraint PostgreSQL.
- Lo **stage di scarto** (`REJECTED`) richiede un motivo, registrato come valutazione non idonea.
- I **feedback** sono uno storico: ogni feedback è una riga, nulla viene sovrascritto.
- La **pipeline** è configurabile nella tabella `recruiting_stages`. Il codice conosce solo
  `NEW` (stage iniziale) e `REJECTED` (regola di scarto); tono e icona degli altri stage sono
  presentazione con fallback neutro.

## Document storage

- PostgreSQL contiene solo i **metadati** (`documents`); i file stanno nello storage.
- Astrazione `DocumentStorage` (`src/services/storage`): `LocalFileStorage` per sviluppo e
  on-premise (`DOCUMENT_STORAGE_DIR`, escluso da git), `MemoryStorage` per i test.
  Un provider cloud si aggiunge implementando l'interfaccia.
- Upload: whitelist MIME + estensione + **firma binaria** del file + limite 10 MB; chiave di
  storage generata dal server (il nome originale non entra mai nel percorso).
- Download solo tramite `/api/documents/[id]` (sessione + permesso, `Content-Disposition: attachment`).
- `DocumentProcessingService` predispone gli stati `UPLOADED → PENDING → PROCESSED | FAILED`
  per il futuro parsing CV; **nessun parser è attivo**.

## Sicurezza (sintesi)

- Autenticazione e autorizzazione server-side; server action protette da CSRF (verifica Origin di Next.js).
- Input validati con Zod su **ogni** server action e sui search params delle liste.
- Query Drizzle sempre parametrizzate; i filtri LIKE fanno l'escape dei caratteri jolly.
- Nessun segreto nel client (nessuna variabile `NEXT_PUBLIC_`), `.env*` ignorati da git.
- Header di sicurezza (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Nessun `dangerouslySetInnerHTML` (regola ESLint `react/no-danger`).

## Futuro bridge ADV CORE

Vedi [ADV_CORE_BRIDGE.md](ADV_CORE_BRIDGE.md). In sintesi: `DATA_SOURCE=adv_core` è
un'opzione **documentata ma non implementata**; l'adapter implementerà le stesse interfacce
dei repository, in sola lettura per i dati legacy.

## Futuro matching con pgvector

Vedi [MATCHING.md](MATCHING.md). Tabelle embedding e matching, contratti e valutatori
"hard filter" sono pronti; **nessun embedding è generato e nessuna API AI è chiamata**.

## Convenzioni

- Server Components di default; `"use client"` solo per interazione (form, filtri, menu, tab).
- Liste filtrate tramite search params dell'URL, validati con Zod.
- Form: React Hook Form + stesso schema Zod del server (`actionResolver`, valori grezzi al server).
- Label italiane centralizzate in `src/config/labels.ts`: mai valori di enum in UI.
- Navigazione con aspetto di pulsante: `ButtonLink` (ruolo "link", non "button").
