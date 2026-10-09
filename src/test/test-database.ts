import { PGlite } from "@electric-sql/pglite";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createPostgresDataStore, type Database } from "@/repositories/postgres";
import type { DataStore } from "@/repositories/types";

export interface TestDatabase {
  db: Database;
  store: DataStore;
  close: () => Promise<void>;
}

/**
 * Database PostgreSQL reale in memoria (PGlite/WASM) con le STESSE
 * migration versionate usate in sviluppo e produzione, pgvector incluso.
 * Nessun Docker o servizio esterno richiesto per i test.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite({ extensions: { vector, unaccent } });
  const db = drizzle(client, { casing: "snake_case" }) as unknown as Database;
  await migrate(drizzle(client), { migrationsFolder: "./drizzle", migrationsTable: "__drizzle_migrations" });
  return { db, store: createPostgresDataStore(db), close: () => client.close() };
}
