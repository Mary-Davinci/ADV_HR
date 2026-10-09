/**
 * RESET DISTRUTTIVO del database di sviluppo: elimina TUTTI i dati,
 * riapplica le migration e ripopola con il seed fittizio.
 * Consentito solo su database locali (vedi seed/guards.ts).
 * Uso: npm run db:reset
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import type { Database } from "@/repositories/postgres";

import { assertSafeDevelopmentDatabase, DEFAULT_DEV_PASSWORD } from "./seed/guards";
import { seedDatabase } from "./seed/seed";

async function main() {
  const url = assertSafeDevelopmentDatabase(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrate(db, { migrationsFolder: "./drizzle", migrationsTable: "__drizzle_migrations" });
    const summary = await seedDatabase(db as unknown as Database, {
      password: process.env.SEED_USER_PASSWORD || DEFAULT_DEV_PASSWORD,
    });
    console.log("✓ Database ricreato e popolato:", summary);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Reset fallito:", error instanceof Error ? error.message : error);
  process.exit(1);
});
