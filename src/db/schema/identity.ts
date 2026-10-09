import { sql } from "drizzle-orm";
import { boolean, index, pgTable, primaryKey, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { createdAt, id, timestamps } from "./_shared";

export const users = pgTable(
  "users",
  {
    id: id(),
    /** Sempre salvata in minuscolo (vedi indice unico su lower(email)). */
    email: varchar("email", { length: 254 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    /** Nullable: utenti futuri potranno autenticarsi solo via SSO. */
    passwordHash: text("password_hash"),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export const roles = pgTable("roles", {
  id: id(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_roles_role_idx").on(t.roleId)],
);

export const recruiterProfiles = pgTable("recruiter_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  department: varchar("department", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  notes: text("notes"),
  ...timestamps(),
});
