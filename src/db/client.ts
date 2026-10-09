import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Database } from "@/repositories/postgres";

/**
 * Pool PostgreSQL condiviso dal processo Next.js. Salvato su globalThis per
 * non moltiplicare le connessioni durante l'hot reload in sviluppo.
 * Nessuna query viene loggata (evita di esporre dati personali nei log).
 */
const globalForDb = globalThis as unknown as { __advHrPool?: Pool };

export function getDatabase(databaseUrl: string): Database {
  globalForDb.__advHrPool ??= new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return drizzle(globalForDb.__advHrPool, { casing: "snake_case" });
}
