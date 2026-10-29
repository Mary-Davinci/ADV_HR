# Produzione su Railway

Progetto Railway, ambiente `production`, regione **EU West (Amsterdam)** per tutto (dati personali).
Le impostazioni si danno dalla dashboard dei servizi: i servizi nuovi non leggono `railway.json`
(Config as Code è deprecato su Railway), quindi il repository non ne contiene.

| Risorsa  | Tipo                                       | Note                                                 |
| -------- | ------------------------------------------ | ---------------------------------------------------- |
| Postgres | immagine `pgvector/pgvector:pg18` + volume | serve l'estensione `vector`: non l'immagine standard |
| Bucket   | Railway Bucket                             | documenti; **nessun backup automatico**              |
| `web`    | GitHub `Mary-Davinci/ADV_HR`               | l'app, dominio `hr.davinciformazione.com`            |
| `sync`   | stesso repository, cron                    | sincronizzazione ADV CORE, IP statici in uscita      |

## Servizio `web`

| Impostazione     | Valore                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Build command    | `npm run build`                                                                                        |
| Start command    | `npm run start`                                                                                        |
| Pre-deploy       | `npm run db:migrate`                                                                                   |
| Healthcheck path | `/login`                                                                                               |
| Dominio          | Settings → Networking → Custom Domain, poi i record indicati (CNAME `hr`, eventuale TXT) nel DNS Aruba |

Variabili (`${{...}}` = riferimenti Railway; i nomi tra parentesi sono quelli delle risorse):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
AUTH_SECRET=<nuovo, openssl rand -base64 32: mai quello di sviluppo>
AUTH_SHOW_DEV_HINT=false
APP_PUBLIC_URL=https://hr.davinciformazione.com

DOCUMENT_STORAGE_PROVIDER=s3
S3_BUCKET=${{<bucket>.BUCKET}}
S3_ENDPOINT=${{<bucket>.ENDPOINT}}
S3_REGION=${{<bucket>.REGION}}
S3_ACCESS_KEY_ID=${{<bucket>.ACCESS_KEY_ID}}
S3_SECRET_ACCESS_KEY=${{<bucket>.SECRET_ACCESS_KEY}}
S3_FORCE_PATH_STYLE=false        # true solo se la scheda Credentials del bucket lo indica

SMTP_HOST=smtps.aruba.it
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@davinciformazione.com
SMTP_PASSWORD=<password della casella>
MAIL_FROM="Accademia Da Vinci - Selezione <no-reply@davinciformazione.com>"
HR_NOTIFICATION_EMAIL=<casella HR che riceve le notifiche se l'autore non ha un'email reale>
```

## Servizio `sync`

| Impostazione   | Valore                                         |
| -------------- | ---------------------------------------------- |
| Build command  | `echo "nessuna build: il sync usa tsx"`        |
| Start command  | `npm run sync:adv-core -- --scheduled`         |
| Cron schedule  | `20 11,12,16,17 * * 1-5` (UTC)                 |
| Restart policy | Never                                          |
| Networking     | **Enable Static IPs**, nessun dominio pubblico |

Variabili: `DATABASE_URL` e le `S3_*`/`DOCUMENT_STORAGE_PROVIDER` come sopra, più

```
ADV_CORE_API_URL=<indirizzo ADV CORE, https>
ADV_CORE_API_KEY=<chiave dedicata alla produzione>
ADV_CORE_SYNC_DOCUMENTS=true
ADV_CORE_SYNC_TIMES=13:20,18:20
```

Dettagli su orari, IP e chiave: [ADV_CORE_BRIDGE.md](ADV_CORE_BRIDGE.md#produzione-su-railway).

## Primo avvio

1. Postgres con pgvector attivo; un proxy TCP pubblico **temporaneo** sul database (Settings →
   Networking) per caricare i dati dal PC ufficio.
2. Dal PC ufficio: `pg_dump` del database locale e ripristino su Railway (stessa o più recente
   versione di PostgreSQL).
3. Dal PC ufficio, con `DATABASE_URL` (proxy) e le `S3_*` del bucket:
   `npm run storage:to-s3 -- --dry-run`, poi `npm run storage:to-s3`.
4. Deploy di `web` (applica le migration mancanti), verifica su `https://hr.davinciformazione.com`.
5. Utenti, sempre dal PC con le variabili di Railway (`railway run ...` o `DATABASE_URL` del proxy):

   ```
   npm run user -- create <email reale di Paola> "Nome Cognome"     # ADMIN,HR_MANAGER
   npm run user -- deactivate-dev                                     # utenti del seed
   npm run user -- list
   ```

   La password generata compare una sola volta. L'email dell'utente deve essere una casella reale:
   è lì che arrivano le notifiche delle richieste di personale create da lei.

6. Rimuovere il proxy TCP pubblico del database.
7. ADV CORE: autorizzare i 3 IP statici del servizio `sync`, poi attivarne il cron e togliere la
   pianificazione dal PC ufficio (`registra-sync-adv-core.ps1 -Rimuovi`).
