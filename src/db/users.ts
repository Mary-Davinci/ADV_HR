/**
 * Gestione degli utenti da riga di comando (non c'è ancora una pagina di amministrazione).
 *
 *   npm run user -- list
 *   npm run user -- create <email> "<Nome Cognome>" [RUOLO,RUOLO]   default ADMIN,HR_MANAGER
 *   npm run user -- password <email>
 *   npm run user -- deactivate <email>
 *   npm run user -- deactivate-dev          disattiva gli utenti del seed (@adv-hr.local)
 *
 * La password è quella di ADV_HR_NEW_PASSWORD (min. 12 caratteri) se impostata, altrimenti
 * ne viene generata una casuale e mostrata UNA sola volta. Nel database finisce solo l'hash.
 * In produzione: `railway run npm run user -- ...` dal PC (le variabili arrivano da Railway).
 */
import { randomBytes } from "node:crypto";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { isRoleCode, type RoleCode } from "@/domain";
import { hashPassword } from "@/lib/auth/password";

import { roles, userRoles, users } from "./schema";

const DEV_DOMAIN = "@adv-hr.local";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.ADV_HR_NEW_PASSWORD;
  if (fromEnv !== undefined) {
    if (fromEnv.length < 12) throw new Error("ADV_HR_NEW_PASSWORD deve avere almeno 12 caratteri.");
    return { password: fromEnv, generated: false };
  }
  return { password: randomBytes(18).toString("base64url"), generated: true };
}

function printPassword({ password, generated }: { password: string; generated: boolean }) {
  if (generated) console.log(`  Password generata (mostrata solo ora, conservala in modo sicuro): ${password}`);
  else console.log("  Password impostata da ADV_HR_NEW_PASSWORD.");
}

function normalizeEmail(raw: string | undefined): string {
  const email = raw?.trim().toLowerCase() ?? "";
  if (!EMAIL.test(email)) throw new Error("Indica un'email valida.");
  return email;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL mancante");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { casing: "snake_case" });

  const findUser = async (email: string) => {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (!user) throw new Error(`Utente ${email} non trovato.`);
    return user;
  };

  try {
    switch (command) {
      case "list": {
        const rows = await db
          .select({ email: users.email, name: users.displayName, active: users.active, role: roles.code })
          .from(users)
          .leftJoin(userRoles, eq(userRoles.userId, users.id))
          .leftJoin(roles, eq(roles.id, userRoles.roleId))
          .orderBy(asc(users.email));
        const byEmail = new Map<string, { name: string; active: boolean; roles: string[] }>();
        for (const row of rows) {
          const entry = byEmail.get(row.email) ?? { name: row.name, active: row.active, roles: [] };
          if (row.role) entry.roles.push(row.role);
          byEmail.set(row.email, entry);
        }
        for (const [email, user] of byEmail) {
          console.log(
            `${user.active ? "attivo     " : "disattivato"}  ${email}  ${user.name}  [${user.roles.join(", ")}]`,
          );
        }
        return;
      }

      case "create": {
        const email = normalizeEmail(args[0]);
        const displayName = args[1]?.trim();
        if (!displayName) throw new Error('Indica nome e cognome tra virgolette, es. "Paola Rossi".');
        const roleCodes = (args[2] ?? "ADMIN,HR_MANAGER").split(",").map((code) => code.trim().toUpperCase());
        const invalid = roleCodes.filter((code) => !isRoleCode(code));
        if (invalid.length)
          throw new Error(`Ruoli non validi: ${invalid.join(", ")} (ADMIN, HR_MANAGER, RECRUITER, VIEWER).`);

        const secret = newPassword();
        const passwordHash = await hashPassword(secret.password);
        await db.transaction(async (tx) => {
          const roleRows = await tx
            .select()
            .from(roles)
            .where(inArray(roles.code, roleCodes as RoleCode[]));
          const [user] = await tx
            .insert(users)
            .values({ email, displayName, passwordHash })
            .returning({ id: users.id });
          await tx.insert(userRoles).values(roleRows.map((role) => ({ userId: user!.id, roleId: role.id })));
        });
        console.log(`✓ Utente creato: ${email} [${roleCodes.join(", ")}]`);
        printPassword(secret);
        return;
      }

      case "password": {
        const user = await findUser(normalizeEmail(args[0]));
        const secret = newPassword();
        await db
          .update(users)
          .set({ passwordHash: await hashPassword(secret.password), updatedAt: new Date() })
          .where(eq(users.id, user.id));
        console.log(`✓ Password aggiornata: ${user.email}`);
        printPassword(secret);
        return;
      }

      case "deactivate": {
        const user = await findUser(normalizeEmail(args[0]));
        await db.update(users).set({ active: false, updatedAt: new Date() }).where(eq(users.id, user.id));
        console.log(`✓ Utente disattivato: ${user.email}`);
        return;
      }

      case "deactivate-dev": {
        const rows = await db
          .update(users)
          .set({ active: false, updatedAt: new Date() })
          .where(sql`lower(${users.email}) LIKE ${"%" + DEV_DOMAIN} AND ${users.active}`)
          .returning({ email: users.email });
        console.log(`✓ Utenti di sviluppo disattivati: ${rows.length}`);
        for (const row of rows) console.log(`  ${row.email}`);
        return;
      }

      default:
        throw new Error("Comando non valido: list | create | password | deactivate | deactivate-dev");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const duplicate = (error as { cause?: { code?: string }; code?: string })?.cause?.code === "23505";
  console.error(
    `✗ ${duplicate ? "Esiste già un utente con questa email." : error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
});
