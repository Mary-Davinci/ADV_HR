/**
 * Copia nel bucket S3 i documenti salvati in locale e li marca come `S3`.
 *
 *   npm run storage:to-s3 -- --dry-run   conta soltanto, non copia nulla
 *   npm run storage:to-s3                copia e aggiorna il database
 *
 * Richiede DOCUMENT_STORAGE_PROVIDER=s3 con le variabili S3_* (destinazione) e
 * DOCUMENT_STORAGE_DIR (sorgente). Le chiavi restano le stesse. Ogni documento
 * passa a `S3` solo dopo aver verificato la dimensione dell'oggetto caricato:
 * lo script si può rilanciare e riprende da dove si era fermato.
 *
 * Codici di uscita: 0 = tutto copiato, 2 = alcuni file mancanti o non copiati, 1 = errore.
 */
import { Pool } from "pg";

import { LocalFileStorage } from "./document-storage";
import { S3Storage } from "./s3-storage";
import { readStorageConfig } from "./storage-config";

const CONCURRENCY = 4;

interface Row {
  id: string;
  storage_key: string;
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes("--dry-run");
  const config = readStorageConfig(process.env);
  if (config.provider !== "s3") throw new Error("Imposta DOCUMENT_STORAGE_PROVIDER=s3 e le variabili S3_*.");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL mancante");

  const source = new LocalFileStorage(process.env.DOCUMENT_STORAGE_DIR ?? "./storage/documents");
  const target = new S3Storage(config);
  const pool = new Pool({ connectionString: databaseUrl, max: CONCURRENCY });
  const stats = { total: 0, copied: 0, missing: 0, failed: 0 };

  try {
    const { rows } = await pool.query<Row>(
      "SELECT id, storage_key FROM documents WHERE storage_provider = 'LOCAL' ORDER BY created_at",
    );
    stats.total = rows.length;
    console.log(`Documenti locali da copiare: ${rows.length}${dryRun ? " (prova, nessuna copia)" : ""}`);
    if (dryRun) return 0;

    let next = 0;
    let lastLog = Date.now();
    async function worker() {
      while (next < rows.length) {
        const row = rows[next++]!;
        try {
          const content = await source.get(row.storage_key);
          if (!content) {
            stats.missing++;
            console.log(`File mancante su disco: documento ${row.id}`);
            continue;
          }
          await target.put(row.storage_key, content);
          if ((await target.size(row.storage_key)) !== content.byteLength) {
            throw new Error("dimensione dell'oggetto diversa dopo il caricamento");
          }
          await pool.query(
            "UPDATE documents SET storage_provider = 'S3' WHERE id = $1 AND storage_provider = 'LOCAL'",
            [row.id],
          );
          stats.copied++;
        } catch (error) {
          stats.failed++;
          console.log(`Copia non riuscita: documento ${row.id} (${error instanceof Error ? error.message : "errore"})`);
        }
        if (Date.now() - lastLog > 10_000) {
          lastLog = Date.now();
          console.log(`Avanzamento: ${stats.copied + stats.missing + stats.failed}/${rows.length}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    await pool.end();
  }

  console.log(`Esito: ${JSON.stringify(stats)}`);
  return stats.missing || stats.failed ? 2 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(`Migrazione documenti non avviata: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
