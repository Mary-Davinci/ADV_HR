import type { RoleCode } from "@/domain";

/**
 * RBAC centralizzato. L'unico posto in cui ruoli e permessi si incontrano:
 * il resto del codice chiede `can(user, "permesso")`, mai `role === ...`.
 */
export const PERMISSIONS = [
  "candidate.read",
  "candidate.create",
  "candidate.edit",
  "application.read",
  "application.manage",
  "evaluation.manage",
  "interview.read",
  "interview.manage",
  "feedback.manage",
  "selection.read",
  "selection.manage",
  "company.read",
  "company.manage",
  "document.read",
  "document.manage",
  "task.read",
  "task.manage",
  "talentPool.read",
  "talentPool.manage",
  "reports.read",
  "settings.read",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: Permission[] = PERMISSIONS.filter(
  (permission) => permission.endsWith(".read") && permission !== "audit.read",
);

export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  HR_MANAGER: [
    ...READ_ONLY,
    "candidate.create",
    "candidate.edit",
    "application.manage",
    "evaluation.manage",
    "interview.manage",
    "feedback.manage",
    "selection.manage",
    "company.manage",
    "document.manage",
    "task.manage",
    "talentPool.manage",
  ],
  RECRUITER: [
    "candidate.read",
    "candidate.create",
    "candidate.edit",
    "application.read",
    "application.manage",
    "evaluation.manage",
    "interview.read",
    "interview.manage",
    "feedback.manage",
    "selection.read",
    "company.read",
    "document.read",
    "document.manage",
    "task.read",
    "task.manage",
    "talentPool.read",
    "talentPool.manage",
  ],
  VIEWER: READ_ONLY.filter((permission) => permission !== "settings.read"),
};

export interface Authorizable {
  roles: readonly RoleCode[];
}

export function can(user: Authorizable | null | undefined, permission: Permission): boolean {
  return Boolean(user?.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission)));
}

export function permissionsOf(user: Authorizable): Permission[] {
  return PERMISSIONS.filter((permission) => can(user, permission));
}

export class ForbiddenError extends Error {
  constructor(readonly permission: Permission) {
    super("Non hai i permessi per eseguire questa operazione.");
    this.name = "ForbiddenError";
  }
}

export function assertCan(user: Authorizable, permission: Permission): void {
  if (!can(user, permission)) throw new ForbiddenError(permission);
}
