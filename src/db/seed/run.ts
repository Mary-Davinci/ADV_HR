/**
 * Popola il database di sviluppo con dati FITTIZI.
 * Uso: npm run db:seed   (richiede migration già applicate e database vuoto)
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Database } from "@/repositories/postgres";

import { assertSafeDevelopmentDatabase, DEFAULT_DEV_PASSWORD } from "./guards";
import { seedDatabase } from "./seed";

async function main() {
  const url = assertSafeDevelopmentDatabase(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool) as unknown as Database;
  try {
    const existing = await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM candidates");
    const count = Number(existing.rows[0]?.count ?? 0);
    if (count > 0) {
      console.log("Il database contiene già dati: seed saltato. Usa `npm run db:reset` per ricrearlo.");
      return;
    }
    const password = process.env.SEED_USER_PASSWORD || DEFAULT_DEV_PASSWORD;
    const summary = await seedDatabase(db, { password });
    console.log("✓ Seed completato:", summary);
    console.log("  Utenti di sviluppo: admin@adv-hr.local (ADMIN), laura.conti@adv-hr.local (HR_MANAGER),");
    console.log(
      "  chiara.moretti@adv-hr.local / paolo.esposito@adv-hr.local (RECRUITER), consulta@adv-hr.local (VIEWER)",
    );
    console.log(
      `  Password: ${process.env.SEED_USER_PASSWORD ? "(da SEED_USER_PASSWORD)" : "vedi README (default di sviluppo)"}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Seed fallito:", error instanceof Error ? error.message : error);
  process.exit(1);
});
