# ADV CORE API v1.1 — allegati dei candidati (bilancio delle competenze, orientamento)

Specifica per chi modifica ADV CORE. ADV_HR la consuma con `npm run sync:adv-core`
(`src/repositories/adv-core/`). Tutto il resto dell'API v1 resta **identico**: si aggiungono
campi ed endpoint, non se ne cambiano.

## Obiettivo

ADV_HR deve mostrare a HR il **bilancio delle competenze** e sapere se il candidato ha
**completato l'orientamento**. In ADV CORE entrambi sono allegati in `allegati_iscritto`
(dump di ottobre 2026: ~1.600 "Bilancio…", ~500 "Colloquio orientamento" / "Orientamento").

**Minimizzazione (GDPR)**: `allegati_iscritto` contiene anche carte d'identità, tessere
sanitarie, DRU, PIP, patti di servizio. L'API espone **solo** le categorie elencate qui sotto,
con una whitelist nella vista. Mai "tutti gli allegati".

## Regole invariate (come per i CV)

- Stessa autenticazione: `Authorization: Bearer <chiave>` + allowlist IP; stessi errori JSON
  `{ "error": { "code", "message" } }`; ogni chiamata registrata in `api_access_log`.
- Solo lettura: le viste `api_v1_*` fanno solo `SELECT`, nessuna scrittura su ADV CORE.
- Il file si scarica **solo per id** letto dalla vista: mai un nome file o un percorso passato
  dal client (niente path traversal). Stessa cartella e stessa logica di `cv.php`.
- Paginazione invariata (`after_id`, `limit`, `pagination.has_more` / `next_after_id`).

## 1. Nuova vista `api_v1_allegati`

Stesse colonne di `api_v1_cv` più i metadati utili e una `categoria` già normalizzata.
Esclude i CV (già esposti in `cv[]`) ed elenca SOLO le categorie ammesse.

```sql
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `api_v1_allegati` AS
SELECT
  a.id_allegato                       AS id,
  a.id_iscritto                       AS id_iscritto,
  TRIM(a.nome_documento)              AS nome_documento,
  CASE
    WHEN LOWER(a.nome_documento) LIKE '%bilancio%'     THEN 'BILANCIO_COMPETENZE'
    WHEN LOWER(a.nome_documento) LIKE '%orientament%'  THEN 'ORIENTAMENTO'
  END                                 AS categoria,
  a.tipo_file                         AS tipo_file,
  a.allegato                          AS nome_file,
  NULLIF(a.data_scadenza, '0000-00-00') AS data_scadenza,
  a.data_inserimento                  AS data_inserimento
FROM allegati_iscritto a
WHERE COALESCE(a.allegato, '') <> ''
  AND (LOWER(a.nome_documento) LIKE '%bilancio%' OR LOWER(a.nome_documento) LIKE '%orientament%')
  AND a.id_allegato NOT IN (SELECT id FROM api_v1_cv);
```

Prima di pubblicarla, controllare i conteggi sul database reale:

```sql
SELECT categoria, COUNT(*) FROM api_v1_allegati GROUP BY categoria;
-- attesi nell'ordine di ~1.600 BILANCIO_COMPETENZE e ~500 ORIENTAMENTO
```

## 2. `candidati.php`: campo `allegati[]` per ogni candidato

Accanto a `cv[]`, stessa forma più `categoria` e `data_scadenza`. `disponibile`,
`dimensione_bytes` e `file_modificato_il` si calcolano come per i CV (il file esiste su disco?).
Candidato senza allegati ammessi: `"allegati": []` (mai assente).

```json
"allegati": [
  {
    "id": 4512,
    "categoria": "BILANCIO_COMPETENZE",
    "nome_documento": "BILANCIO DELLE COMPETENZE",
    "tipo_file": "application/pdf",
    "disponibile": true,
    "dimensione_bytes": 182344,
    "file_modificato_il": "2025-08-09 10:12:00",
    "data_scadenza": null,
    "data_inserimento": "2025-08-09 10:12:00"
  }
]
```

Caricare gli allegati di una pagina con UNA query (`WHERE id_iscritto IN (...)`), come per i CV:
niente query per singolo candidato.

## 3. Nuovo endpoint `allegato.php?id=<id>`

Copia di `cv.php` che legge da `api_v1_allegati` invece di `api_v1_cv`:

- `id` intero obbligatorio, altrimenti `400 bad_request`;
- id non presente nella vista → `404 not_found` (così un id di carta d'identità non si scarica
  nemmeno conoscendolo);
- file mancante su disco → `404 file_missing`;
- risposta: il file con `Content-Type` = `tipo_file` (fallback `application/octet-stream`),
  `Content-Length`, `Content-Disposition: attachment`, `Cache-Control: no-store`,
  `X-Content-Type-Options: nosniff`.

## 4. `stato.php`

- `api_version`: `"1.1"`;
- nuovo contatore `"allegati": <COUNT(*) FROM api_v1_allegati>`.

Nessun altro campo cambia.

## 5. Verifica prima del rilascio

```bash
# sostituire URL e CHIAVE; da un IP autorizzato
curl -s -H "Authorization: Bearer $CHIAVE" "$URL/api/v1/stato.php"
curl -s -H "Authorization: Bearer $CHIAVE" "$URL/api/v1/candidati.php?after_id=0&limit=5" | jq '.data[] | {id, allegati}'
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" -H "Authorization: Bearer $CHIAVE" "$URL/api/v1/allegato.php?id=<un id della vista>"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CHIAVE" "$URL/api/v1/allegato.php?id=<id di una carta d'identità>"   # atteso 404
curl -s -o /dev/null -w "%{http_code}\n" "$URL/api/v1/allegato.php?id=1"   # senza chiave: atteso 401
```

## Lato ADV_HR (dopo il rilascio)

Il sync scaricherà gli allegati come documenti del candidato (nuovi tipi "Bilancio delle
competenze" e "Orientamento"), con la stessa logica incrementale dei CV; un allegato
`ORIENTAMENTO` imposterà "orientamento completato" (data = `data_inserimento`) se HR non l'ha
già indicato a mano. Con `api_version` < 1.1 il sync continua a funzionare come oggi.
