/**
 * Applica le migration versionate in ./drizzle al database DATABASE_URL.
 * Uso: npm run db:migrate
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non impostata (vedi .env.example)");

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle", migrationsTable: "__drizzle_migrations" });
    console.log("✓ Migration applicate");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Migration fallita:", error instanceof Error ? error.message : error);
  process.exit(1);
});
