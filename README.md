# ADV_HR

Piattaforma HR di Accademia Da Vinci — **V1 persistente** (PostgreSQL).

> ADV_HR è un sistema autonomo. **Non è collegato ad ADV CORE** e non usa servizi AI esterni.
> Tutti i dati di sviluppo sono **fittizi**. Architettura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requisiti

- Node.js ≥ 20.9 (sviluppato con Node 24), npm
- Docker (per PostgreSQL 17 + pgvector in sviluppo)

## Avvio rapido

```bash
npm install
cp .env.example .env.local      # imposta AUTH_SECRET (npx auth secret)
npm run db:up                   # PostgreSQL 17 + pgvector su 127.0.0.1:5433
npm run db:migrate              # migration versionate
npm run db:seed                 # dati fittizi
npm run dev
```

Apri http://localhost:3000.

### Utenti di sviluppo (creati dal seed)

| Email                         | Ruolo                        |
| ----------------------------- | ---------------------------- |
| `admin@adv-hr.local`          | Amministratore               |
| `laura.conti@adv-hr.local`    | Responsabile HR              |
| `chiara.moretti@adv-hr.local` | Recruiter                    |
| `paolo.esposito@adv-hr.local` | Recruiter                    |
| `consulta@adv-hr.local`       | Consultazione (sola lettura) |

Password di sviluppo: `AdvHr-Dev-2026!`, oppure il valore di `SEED_USER_PASSWORD`.
Nel database è salvato solo l'hash scrypt. `npm run db:reset` ricrea il database locale da zero.

## Script

| Comando                                           | Descrizione                                            |
| ------------------------------------------------- | ------------------------------------------------------ |
| `npm run dev` / `build` / `start`                 | Sviluppo, build e avvio di produzione                  |
| `npm run lint` · `npm run typecheck` · `npm test` | Quality gates (`npm run check` li esegue tutti)        |
| `npm run db:up`                                   | Avvia il container PostgreSQL di sviluppo              |
| `npm run db:generate`                             | Genera una migration dallo schema Drizzle              |
| `npm run db:migrate`                              | Applica le migration                                   |
| `npm run db:seed`                                 | Popola un database vuoto con dati fittizi              |
| `npm run db:reset`                                | **Distruttivo**: ricrea schema + seed (solo DB locali) |
| `npm run db:studio`                               | Drizzle Studio                                         |

I test usano **PGlite** (PostgreSQL in memoria, con pgvector) e le stesse migration: non serve Docker.

## Variabili d'ambiente

Vedi `.env.example`: `AUTH_SECRET`, `DATABASE_URL`, `DATA_SOURCE` (`postgres`),
`DOCUMENT_STORAGE_DIR`, `AUTH_SHOW_DEV_HINT`, `SEED_USER_PASSWORD` (opzionale).
Nessuna variabile è esposta al browser.

## Funzionalità e route

| Route                                      | Contenuto                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                               | KPI reali, prossimi colloqui, ultime attività, task, selezioni attive                                                                                                                 |
| `/recruiting`                              | Ricerca candidati con filtri strutturati (città, regione, skill, settore, lingua, patente, L. 68/99, trasferimento, modalità, orario, esperienza minima, stato, recruiter, colloquio) |
| `/recruiting/[id]`                         | Scheda candidato a tab: panoramica, profilo, esperienze, competenze, formazione, preferenze, candidature, colloqui, documenti, timeline                                               |
| `/selections`                              | Tutte le selezioni aziendali                                                                                                                                                          |
| `/companies`, `/companies/[id]`            | Aziende: profilo, selezioni, documenti, timeline                                                                                                                                      |
| `/companies/[id]/selections/[selectionId]` | Selezione: pipeline, job description, colloqui, documenti, timeline                                                                                                                   |
| `/interviews`                              | Colloqui: oggi, prossimi, passati, con filtri                                                                                                                                         |
| `/calendar`                                | Vista giorno / settimana / mese                                                                                                                                                       |
| `/tasks`                                   | Task HR                                                                                                                                                                               |
| `/talent-pools`, `/talent-pools/[id]`      | Talent pool                                                                                                                                                                           |
| `/reports`                                 | Report di base                                                                                                                                                                        |
| `/settings`                                | Profilo, pipeline, informazioni di sistema                                                                                                                                            |

## Documentazione

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): livelli, RBAC, activity, audit, storage, sicurezza
- [docs/DATABASE.md](docs/DATABASE.md): schema, migration, indici, seed, scelta ORM
- [docs/MATCHING.md](docs/MATCHING.md): architettura del matching (predisposta, non attiva)
- [docs/ADV_CORE_BRIDGE.md](docs/ADV_CORE_BRIDGE.md): bridge futuro verso ADV CORE (solo architettura)
