/**
 * Esegue la sincronizzazione ADV CORE → ADV_HR.
 *
 *   npm run sync:adv-core                 esecuzione manuale
 *   npm run sync:adv-core -- --scheduled  usata dall'Utilità di pianificazione (lun-ven 13:20 e 18:20)
 *
 * Codici di uscita: 0 = SUCCESS, 2 = PARTIAL, 1 = FAILED o configurazione errata,
 * 3 = un'altra sincronizzazione è già in corso.
 */
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Database } from "@/repositories/postgres";
import { LocalFileStorage } from "@/services/storage/document-storage";

import { createAdvCoreClient } from "./client";
import { readAdvCoreSyncConfig } from "./config";
import { closeStaleRuns, runAdvCoreSync } from "./sync";

/** Chiave del lock applicativo PostgreSQL: impedisce due sincronizzazioni contemporanee. */
const LOCK_KEY = 4_170_201;

async function main(): Promise<number> {
  const config = readAdvCoreSyncConfig(process.env);
  const trigger = process.argv.includes("--scheduled") ? "SCHEDULED" : "MANUAL";

  await mkdir(config.logDir, { recursive: true });
  const logFile = path.join(config.logDir, `adv-core-sync-${new Date().toISOString().slice(0, 7)}.log`);
  const log = (message: string) => {
    const line = `${new Date().toISOString()} ${message}`;
    console.log(line);
    void appendFile(logFile, line + "\n").catch(() => undefined);
  };

  const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY]);
    if (!lock.rows[0]?.ok) {
      log("Un'altra sincronizzazione ADV Core è in corso: esecuzione saltata.");
      return 3;
    }

    const db = drizzle(pool, { casing: "snake_case" }) as unknown as Database;
    const stale = await closeStaleRuns(db, new Date(Date.now() - 3 * 60 * 60 * 1000));
    if (stale) log(`Chiuse ${stale} esecuzioni precedenti rimaste in sospeso.`);

    log(`Avvio sincronizzazione (${trigger}).`);
    const summary = await runAdvCoreSync({
      db,
      client: createAdvCoreClient({ baseUrl: config.apiUrl, apiKey: config.apiKey }),
      storage: new LocalFileStorage(config.documentStorageDir),
      trigger,
      syncDocuments: config.syncDocuments,
      log,
    });
    log(
      `Esito ${summary.status} - ${JSON.stringify(summary.stats)}${summary.errorMessage ? ` - ${summary.errorMessage}` : ""}`,
    );
    return summary.status === "SUCCESS" ? 0 : summary.status === "PARTIAL" ? 2 : 1;
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    lockClient.release();
    await pool.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      `${new Date().toISOString()} Sincronizzazione ADV Core non avviata: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  });
