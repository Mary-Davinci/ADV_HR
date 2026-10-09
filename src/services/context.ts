import type { ActivityEntityType, AuditAction, EntityId, NewActivity, SessionUser } from "@/domain";
import type { DataStore, Repositories } from "@/repositories/types";

/**
 * Contesto di esecuzione dei servizi: sorgente dati, utente che agisce
 * e orologio (iniettabile nei test). I servizi non leggono mai sessione
 * o variabili d'ambiente direttamente.
 */
export interface ServiceContext {
  store: DataStore;
  actor: SessionUser;
  now?: () => Date;
}

export const nowOf = (context: ServiceContext) => (context.now ? context.now() : new Date());

export class NotFoundError extends Error {
  constructor(message = "Elemento non trovato.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export interface EventInput {
  activity?: Omit<NewActivity, "actorId">;
  audit?: {
    entityType: ActivityEntityType | "USER";
    entityId: EntityId;
    action: AuditAction;
    /** Solo nomi di campo o valori non sensibili (vedi docs/ARCHITECTURE.md → Audit). */
    changes?: Record<string, unknown> | null;
  };
}

/**
 * Registra activity (timeline) e audit (traccia tecnica) con gli stessi
 * repository della transazione in corso: stessa sorte dell'operazione.
 */
export async function recordEvent(repositories: Repositories, actor: SessionUser, event: EventInput): Promise<void> {
  if (event.activity) {
    await repositories.activities.record({ ...event.activity, actorId: actor.id });
  }
  if (event.audit) {
    await repositories.audit.record({
      actorId: actor.id,
      entityType: event.audit.entityType,
      entityId: event.audit.entityId,
      action: event.audit.action,
      changes: event.audit.changes ?? null,
    });
  }
}

/** Nomi dei campi modificati tra due oggetti (confronto superficiale, JSON). */
export function changedFields<T extends object>(before: T, after: Partial<T>): string[] {
  return (Object.keys(after) as Array<keyof T>).filter(
    (key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null),
  ) as string[];
}
