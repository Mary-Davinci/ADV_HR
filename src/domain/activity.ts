import type { EntityId, UserRef } from "./shared";

export const ACTIVITY_ENTITY_TYPES = [
  "CANDIDATE",
  "APPLICATION",
  "INTERVIEW",
  "COMPANY",
  "SELECTION",
  "DOCUMENT",
  "TASK",
  "TALENT_POOL",
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

/** Azioni che rappresentano un contatto con il candidato: alimentano "ultimo contatto". */
export const CONTACT_ACTIONS = ["PHONE_CALL", "EMAIL", "WHATSAPP", "INTERVIEW", "FOLLOW_UP", "OTHER_CONTACT"] as const;
export type ContactAction = (typeof CONTACT_ACTIONS)[number];

export const ACTIVITY_ACTIONS = [
  "CREATED",
  "UPDATED",
  "STATUS_CHANGED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_UPDATED",
  "INTERVIEW_COMPLETED",
  "INTERVIEW_CANCELLED",
  "FEEDBACK_ADDED",
  "EVALUATION_ADDED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_DELETED",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "ADDED_TO_POOL",
  "REMOVED_FROM_POOL",
  "APPLICATION_CREATED",
  "APPLICATION_REMOVED",
  ...CONTACT_ACTIONS,
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export function isContactAction(action: ActivityAction): action is ContactAction {
  return (CONTACT_ACTIONS as readonly string[]).includes(action);
}

/**
 * Evento di timeline. `candidateId`, `selectionId` e `companyId` sono
 * riferimenti di contesto: permettono di ricostruire la timeline di un
 * candidato o di una selezione senza join ricorsivi.
 */
export interface Activity {
  id: EntityId;
  entityType: ActivityEntityType;
  entityId: EntityId;
  action: ActivityAction;
  actor: UserRef | null;
  candidateId: EntityId | null;
  selectionId: EntityId | null;
  companyId: EntityId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type NewActivity = Omit<Activity, "id" | "actor" | "createdAt" | "candidateId" | "selectionId" | "companyId"> & {
  actorId: EntityId | null;
  candidateId?: EntityId | null;
  selectionId?: EntityId | null;
  companyId?: EntityId | null;
};

/* ------------------------------------------------------------------ */
/* Audit                                                                */
/* ------------------------------------------------------------------ */

export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "STAGE_CHANGE", "EVALUATE", "UPLOAD", "LOGIN"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Traccia tecnica delle modifiche. `changes` contiene SOLO i nomi dei campi
 * e, per i campi non sensibili, i valori prima/dopo. Mai password, token,
 * contenuti di documenti o dati personali non necessari.
 */
export interface AuditLog {
  id: EntityId;
  actorId: EntityId | null;
  entityType: ActivityEntityType | "USER";
  entityId: EntityId;
  action: AuditAction;
  changes: Record<string, unknown> | null;
  createdAt: Date;
}

export type NewAuditLog = Omit<AuditLog, "id" | "createdAt">;
