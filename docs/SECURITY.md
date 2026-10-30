# Controlli di sicurezza — 30 ottobre 2026

## Dipendenze

- Next.js ed eslint-config-next aggiornati a 16.4.3.
- PDF.js aggiornato a 6.4.299, Nodemailer a 10.3.1, Zod a 4.6.7 e Vitest a 5.0.5.
- Dipendenze transitive aggiornate senza downgrade automatici o `npm audit fix --force`.
- Il CLI shadcn non è necessario al runtime: i suoi CSS 4.21.0 sono conservati in
  `src/app/shadcn-utilities.css`, con licenza MIT accanto al file. Per generare nuovi
  componenti si può usare il CLI tramite `npx` senza aggiungerlo alle dipendenze del sito.
- L'override Nodemailer unifica anche i peer opzionali di Auth.js sulla versione corretta.
  L'app usa esclusivamente il provider Credentials; gli invii SMTP hanno test separati.
- L'override esbuild di `@esbuild-kit/core-utils` elimina la vecchia copia vulnerabile
  del tool Drizzle. Verificare anche `npm run db:generate` dopo futuri aggiornamenti.

Verifica: `npm audit` e `npm audit --omit=dev`, oltre a TypeScript, lint, test e build.
Un audit senza segnalazioni riguarda gli avvisi noti del registro, non certifica l'intera app.

## File ed email

L'estrazione CV rifiuta input oltre 10 MB. I DOCX sono limitati a 2048 voci ZIP e
4 MB di XML decompresso, verificati sia dai metadati sia dal limite effettivo del
decompressore. Archivi cifrati, directory troncate e riferimenti fuori limite sono rifiutati.
I filtri del testo evitano backtracking quadratico su tag malformati e spazi Unicode ripetuti.
Per i PDF si estrae solo il testo, con limite di pagine e caratteri, senza rendering immagini;
le risorse del parser vengono rilasciate anche in caso di errore.

SMTP richiede TLS anche sulla porta STARTTLS, vieta l'accesso a file e URL dal messaggio
e ha timeout espliciti. I test usano un server locale senza inviare email all'esterno.

## Accessi

Gli account `@adv-hr.local` sono ammessi solo fuori dalla produzione. Il blocco è applicato
al login, al rinnovo JWT e al controllo autorevole delle sessioni esistenti.
Il suggerimento degli account di sviluppo non viene mai mostrato in produzione.
Il limite persistente del login e la rete privata Postgres sono descritti in `DEPLOY.md`.
HTTPS in produzione usa anche HSTS sul solo hostname del sito, senza imporre policy ad altri sottodomini.

## Storage e recupero

Le richieste anonime di elenco e lettura al bucket di produzione restituiscono 403 AccessDenied.
I file sono serviti dall'app con sessione e permesso `document.read`, senza cache condivisa.

I backup del volume Postgres e le copie dei documenti sono due protezioni distinte:
un backup del database non contiene i file S3. Verificare periodicamente un ripristino
su risorse separate, senza sovrascrivere la produzione.

Postgres ha backup automatici DAILY e WEEKLY (conservazione Railway: 6 e 27 giorni)
e una copia manuale iniziale. Il servizio `document-backup` esegue ogni giorno alle
02:00 UTC `npm run storage:backup`, nella regione Amsterdam e senza dominio pubblico.
Legge il bucket `indexed-vault` e scrive nel bucket indipendente `hr-document-backups`.
L'app web non riceve le credenziali del bucket di backup.

Ogni snapshot documenti ha un prefisso univoco e un manifest con dimensioni e SHA-256.
Il manifest viene scritto solo dopo la copia di tutti gli oggetti. Le copie più vecchie
di sette giorni completi vengono rimosse solo dopo un nuovo snapshot riuscito e non vuoto.
La retention non cancella mai dal bucket sorgente. Gli errori fanno fallire il job;
i log contengono solo conteggi e nomi degli errori, mai nomi di persone o file.

Per ripristinare un documento, scegliere uno snapshot completo, verificare lo SHA-256
rispetto al manifest e ricopiare l'oggetto sulla chiave originale. Per un ripristino
totale servono sia lo snapshot Postgres sia quello documenti dello stesso periodo;
le due copie non costituiscono una transazione unica.

Prima copia documenti completata: 2173 oggetti, 967086178 byte. Tre documenti sono stati
riletti dal backup e confrontati con dimensione e SHA-256 del manifest, con esito positivo.
Il ripristino completo del database non è stato simulato.
