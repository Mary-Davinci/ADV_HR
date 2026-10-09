import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { recruiterProfiles, roles, userRoles, users } from "@/db/schema";
import { isRoleCode, type EntityId, type RoleCode, type User, type UserRef } from "@/domain";

import type { UserRepository } from "../types";
import type { Database } from "./db";

type UserRow = typeof users.$inferSelect;

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  private async rolesOf(userId: EntityId): Promise<RoleCode[]> {
    const rows = await this.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));
    return rows.map((row) => row.code).filter(isRoleCode);
  }

  private toUser(row: UserRow, roleCodes: RoleCode[]): User {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      active: row.active,
      roles: roleCodes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByEmailWithCredentials(email: string) {
    const [row] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);
    if (!row) return null;
    return { ...this.toUser(row, await this.rolesOf(row.id)), passwordHash: row.passwordHash };
  }

  async getById(id: EntityId) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? this.toUser(row, await this.rolesOf(row.id)) : null;
  }

  async listRecruiters(): Promise<UserRef[]> {
    // Recruiter = utente attivo con profilo recruiter oppure ruolo RECRUITER/HR_MANAGER.
    return this.db
      .selectDistinct({ id: users.id, displayName: users.displayName })
      .from(users)
      .leftJoin(recruiterProfiles, eq(recruiterProfiles.userId, users.id))
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.active, true),
          sql`(${recruiterProfiles.userId} IS NOT NULL OR ${roles.code} IN ('RECRUITER', 'HR_MANAGER'))`,
        ),
      )
      .orderBy(asc(users.displayName));
  }

  async listActive(): Promise<UserRef[]> {
    return this.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.displayName));
  }

  async create(input: { email: string; displayName: string; passwordHash: string | null; roles: RoleCode[] }) {
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName,
        passwordHash: input.passwordHash,
      })
      .returning();
    if (!row) throw new Error("Creazione utente fallita");

    if (input.roles.length > 0) {
      const roleRows = await this.db.select({ id: roles.id }).from(roles).where(inArray(roles.code, input.roles));
      await this.db.insert(userRoles).values(roleRows.map((role) => ({ userId: row.id, roleId: role.id })));
    }
    return this.toUser(row, input.roles);
  }
}
