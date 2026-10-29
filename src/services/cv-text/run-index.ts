/**
 * Indicizza il testo dei CV non ancora elaborati (estrazione locale).
 *
 *   npm run cv:index
 *
 * Viene eseguito anche in coda a ogni sincronizzazione ADV Core.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Database } from "@/repositories/postgres";
import { createDocumentStorage, readStorageConfig } from "@/services/storage/storage-config";

import { indexCandidateCvTexts } from "./index-cv-texts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL mancante");
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  try {
    const db = drizzle(pool, { casing: "snake_case" }) as unknown as Database;
    const started = Date.now();
    let lastLog = 0;
    const summary = await indexCandidateCvTexts({
      db,
      storage: createDocumentStorage(readStorageConfig(process.env)),
      onProgress: (done, total) => {
        if (done === total || Date.now() - lastLog > 10_000) {
          lastLog = Date.now();
          console.log(`CV elaborati: ${done}/${total}`);
        }
      },
    });
    console.log(
      `Indicizzazione CV completata in ${Math.round((Date.now() - started) / 1000)} s: ${JSON.stringify(summary.byStatus)}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`Indicizzazione CV non riuscita: ${error instanceof Error ? error.name : "errore"}`);
  process.exit(1);
});
