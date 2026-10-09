import type { AuditInfo, EntityId } from "./shared";

export const ROLE_CODES = ["ADMIN", "HR_MANAGER", "RECRUITER", "VIEWER"] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export function isRoleCode(value: unknown): value is RoleCode {
  return typeof value === "string" && (ROLE_CODES as readonly string[]).includes(value);
}

export interface User extends AuditInfo {
  id: EntityId;
  email: string;
  displayName: string;
  active: boolean;
  roles: RoleCode[];
}

/**
 * Utente con le credenziali necessarie all'autenticazione.
 * Non deve mai uscire dal layer server (repository → auth).
 */
export interface UserWithCredentials extends User {
  passwordHash: string | null;
}

export interface RecruiterProfile {
  userId: EntityId;
  department: string | null;
  phone: string | null;
  notes: string | null;
}

/** Proiezione minima esposta alla sessione e al client. */
export interface SessionUser {
  id: EntityId;
  email: string;
  name: string;
  roles: RoleCode[];
}
