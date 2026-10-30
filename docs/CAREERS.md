# Portale candidature

Il portale è integrato in ADV_HR e usa PostgreSQL e lo storage privato esistenti. Durante il collaudo pubblico è disponibile su `https://hr.davinciformazione.com/jobs/aziende`; Zoho resta attivo fino al cambio del DNS.

## Uso

1. Aprire una selezione in stato **Aperta**, quindi la scheda **Sito pubblico**.
2. Scegliere Offerte delle aziende oppure Lavora con noi, compilare i testi pubblici e premere **Pubblica annuncio**. Nessuna selezione viene pubblicata automaticamente. Il nome azienda iniziale è volutamente generico.
3. Il visitatore richiede un link via email, valido 30 minuti, quindi inserisce nome, cognome, telefono, CV PDF (massimo 10 MB), messaggio facoltativo e accettazione dell’informativa fornita dal titolare.
4. L’invio crea un candidato con origine **Sito web**, il CV nei Documenti e una candidatura nella fase iniziale della selezione. Gli invii spontanei creano candidato e CV senza assegnazioni arbitrarie.
5. Nella scheda candidato **Dal sito web** sono visibili messaggio e data di accettazione. Se l’email esiste già, viene segnalato il profilo da confrontare: i dati precedenti non vengono sovrascritti.

Ritiro, scadenza o chiusura della selezione nascondono l’offerta e bloccano i nuovi invii per quell’offerta. I link pubblici degli annunci restano stabili agli aggiornamenti. Riaprire una selezione con pubblicazione ancora attiva rende nuovamente visibile l’annuncio, se non scaduto.

## Protezioni e limiti

- I dati pubblici sono una copia esplicita dei soli campi approvati; note interne e contatti aziendali non vengono restituiti.
- Solo gli utenti con permesso `selection.manage` possono pubblicare o ritirare.
- Limiti persistenti: 10 richieste link/IP/ora, 3/email/ora, 100 complessive/ora; 10 tentativi di upload/IP/ora. Honeypot contro invii automatici semplici. Gli identificatori del limite sono HMAC, senza indirizzi IP in chiaro.
- Token casuali a 256 bit, solo hash nel database, scadenza 30 minuti e consumo atomico. Invii duplicati non creano duplicati; errori della transazione eliminano il file appena caricato.
- CV nello storage privato esistente, incluso nei backup documentali. Download richiede login e permesso documenti. Verifica di estensione, tipo, firma e dimensioni; **non è una scansione antivirus**.
- Pagine con token: `no-store`, `no-referrer`, `noindex`. Nessun dato o CV viene inviato a Zoho.
- Informativa: <https://www.davinciformazione.com/privacy-policy/>, versione registrata `2026-10-30`. Il riferimento non sostituisce la verifica del titolare circa finalità, conservazione e gestione dei diritti. Non viene raccolto consenso marketing.
- Nessun import automatico di annunci o candidature storiche da Zoho. I vecchi URL degli annunci sotto `/jobs/Careers/...` mostrano un avviso e i collegamenti alle offerte attuali.

## Passaggio da Zoho

1. Verificare l’anteprima, pubblicare gli annunci effettivamente destinati al sito e collaudare la ricezione email con un indirizzo controllato dal team.
2. Aggiungere su Railway il dominio `jobs.davinciformazione.com`, porta 8080. Conservare il valore DNS attuale di Zoho per il ripristino.
3. Sostituire in Aruba soltanto il CNAME `jobs` con il valore **esatto** restituito da Railway e aggiungere l’eventuale record di verifica richiesto. Non modificare MX, `hr`, dominio principale o nameserver.
4. Attendere il certificato valido di Railway. Verificare sia `/jobs/aziende` sia `/jobs/Careers`, caricamento CV e accesso riservato ai documenti.
5. Impostare `CAREERS_PUBLIC_URL=https://jobs.davinciformazione.com` per i link email. `APP_PUBLIC_URL` e `AUTH_URL` restano sull’HR. Abilitare `CAREERS_INDEXABLE=true` quando il contenuto definitivo è pronto e distribuire la nuova configurazione.

L’accesso alla radice di `jobs` porta alle offerte; i percorsi del gestionale su quel dominio rimandano a `hr`. Prima del cambio DNS i link email usano l’URL HR di anteprima e continuano a funzionare dopo il passaggio.

Dominio predisposto su Railway il 30 ottobre 2026 (DNS Aruba ancora da aggiornare):

| Tipo  | Nome in Aruba          | Valore richiesto                                                                  |
| ----- | ---------------------- | --------------------------------------------------------------------------------- |
| CNAME | `jobs`                 | `dammdqlr.up.railway.app`                                                         |
| TXT   | `_railway-verify.jobs` | `railway-verify=39387218218bc7443b30ebc7f68eb89f4bfee347d5bb9b497a9f3b39febe2ecf` |

Valore CNAME precedente, per eventuale ritorno a Zoho: `recruit.cs.zohohost.eu`. Ricontrollare i record nella pagina dominio di Railway prima di un passaggio effettuato in un secondo momento.

## Verifica

Test del servizio su PostgreSQL in memoria con tutte le migration: pubblicazione e permessi, isolamento dei campi interni, scadenze anche in ora legale, ritiro, email e token, candidatura spontanea, duplicati, consenso, tipo di file, rate limit, errore email, invio concorrente e pulizia dopo rollback.

Collaudo browser locale con Chrome/Playwright: login HR, pubblicazione dalla selezione, elenco anonimo mobile senza overflow, richiesta email nella outbox locale, PDF, conferma invio, verifica record candidato/pipeline/documento/informativa, messaggio nel gestionale, rifiuto download anonimo e ritiro con risposta 404. Dati di prova rimossi al termine. L’invio SMTP reale va provato con un destinatario autorizzato dal team prima del cambio DNS.
