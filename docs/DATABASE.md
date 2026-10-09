# Database ADV_HR

PostgreSQL 17 con estensioni `vector` (pgvector) e `unaccent`.

## Scelta ORM

**Drizzle ORM** (scelto rispetto a Prisma):

| Criterio    | Drizzle                                                       | Prisma                            |
| ----------- | ------------------------------------------------------------- | --------------------------------- |
| pgvector    | tipo `vector` e indici HNSW nativi                            | `Unsupported("vector")` + SQL raw |
| Runtime     | nessun engine binario, query builder leggero                  | client generato + engine          |
| Test        | stesso codice su `pg` e **PGlite** (Postgres WASM in memoria) | richiede un DB reale              |
| Migration   | SQL leggibile e modificabile                                  | SQL generato, meno controllo      |
| Transazioni | `db.transaction(tx => …)` con lo stesso tipo di `db`          | interactive transactions          |

Driver runtime: `pg` (node-postgres). Test: `@electric-sql/pglite` + `pglite-pgvector`.

## Ambiente di sviluppo

```bash
npm run db:up        # avvia PostgreSQL 17 + pgvector (docker compose, porta 5433)
npm run db:migrate   # applica le migration versionate (./drizzle)
npm run db:seed      # dati FITTIZI (solo se il DB è vuoto)
npm run db:reset     # DISTRUTTIVO: ricrea schema + migration + seed (solo DB locali)
npm run db:generate  # genera una nuova migration dallo schema
npm run db:studio    # Drizzle Studio
```

`db:seed` e `db:reset` rifiutano di operare con `NODE_ENV=production` o su host non locali.

## Migration

| File                         | Contenuto                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `0000_initial_schema.sql`    | `CREATE EXTENSION vector`, enum, 38 tabelle, FK, indici, CHECK                    |
| `0001_reference_data.sql`    | ruoli e stage iniziali della pipeline (idempotente, `ON CONFLICT DO NOTHING`)     |
| `0002_search_extensions.sql` | `CREATE EXTENSION unaccent` (ricerca insensibile agli accenti)                    |
| `0003_adv_core_sync.sql`     | tabelle `adv_core_records`, `adv_core_sync_runs` per la sincronizzazione ADV CORE |

Nessuna migration distruttiva. In produzione le estensioni `vector` e `unaccent` devono
essere abilitate da un utente con privilegi adeguati (DBA). Nuovi valori di enum richiedono
una migration `ALTER TYPE … ADD VALUE`.

## Tabelle

**Identity**: `users` (email univoca case-insensitive, `password_hash` nullable per SSO futuro),
`roles`, `user_roles`, `recruiter_profiles`.

**Candidato**: `candidates` (solo identità), `candidate_profiles` (residenza, L. 68/99, stato
occupazionale, sintesi, `last_reviewed_at`), `candidate_preferences` (disponibilità, orario,
modalità, trasferimento, sedi), `candidate_experiences` (durata **derivata**, non salvata),
`candidate_education`, `candidate_interests`, `skills` + `candidate_skills` (catalogo
normalizzato), `candidate_languages`, `candidate_certifications`, `candidate_driving_licenses`,
`active_policy_participations`, `tags` + `candidate_tags`.

**Recruiting**: `companies`, `recruitment_selections`, `job_descriptions` (1:1 con selezione),
`recruiting_stages` (pipeline configurabile), `applications` (candidato × selezione, univoca),
`application_evaluations` (storico, CHECK motivazione per `NOT_SUITABLE`), `interviews`,
`feedbacks` (storico).

**Operatività**: `activities` (timeline + ultimo contatto), `audit_logs`, `tasks`,
`documents` (solo metadati + stato elaborazione), `talent_pools`, `talent_pool_candidates`.

**Sincronizzazione ADV CORE** (docs/ADV_CORE_BRIDGE.md): `legacy_mappings`, `adv_core_records`,
`adv_core_sync_runs`.

**Predisposte, non usate in V1**: `candidate_embeddings`,
`job_description_embeddings`, `matching_runs`, `matching_results`, `matching_evidence`.

## Indici principali

- `candidates`: `lower(last_name)`, `fiscal_code` (unico), `lower(email)`, `updated_at`
- `candidate_profiles`: `lower(residence_city)`, `residence_region`
- `applications`: `candidate_id`, `selection_id`, `stage_id`, `recruiter_id`, unico `(candidate_id, selection_id)`
- `interviews`: `scheduled_at`, `recruiter_id`, `application_id`
- `activities`: `(entity_type, entity_id)`, `created_at`, `(candidate_id, created_at)`, `(selection_id, created_at)`, `(company_id, created_at)`
- `companies`: `lower(name)`, `vat_number` (unico)
- `recruitment_selections`: `company_id`, `status`
- embedding: indici HNSW `vector_cosine_ops`

Full-text search: oggi `ILIKE` + `unaccent` (adeguato ai volumi attuali). Con volumi maggiori
valutare `pg_trgm` o `tsvector` con indici GIN.

## Vincoli di integrità

- `application_evaluations`: `result <> 'NOT_SUITABLE' OR reason non vuota`
- `candidate_experiences`: `end_date >= start_date`
- `candidate_skills.level` tra 1 e 5; `interviews.duration_minutes` tra 5 e 600
- `job_descriptions`: `salary_max >= salary_min`

## Seed

Completamente **fittizio** (`src/db/seed/fixtures.ts`): 5 utenti (1 admin, 1 HR manager,
2 recruiter, 1 consultazione), 18 candidati, 5 aziende, 8 selezioni con job description,
17 candidature, 11 colloqui, feedback, valutazioni, skill, lingue, patenti, politiche
attive, task, talent pool, tag e timeline coerente. Codici fiscali con codice comune
inesistente (`X000`), email su domini `.test` / `.local`.
