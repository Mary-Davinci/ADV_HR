/**
 * Tipi condivisi del domain model ADV_HR.
 *
 * Il domain model è volutamente indipendente da qualsiasi sorgente dati
 * (database ADV_HR, futuro bridge ADV CORE): nessun nome di colonna
 * o convenzione legacy deve comparire qui.
 */

/** Identificativo opaco di un'entità (UUID in ADV_HR). Non assumere che sia numerico. */
export type EntityId = string;

/** Data di calendario senza orario, formato `YYYY-MM-DD`. */
export type ISODate = string;

/** Orario locale, formato `HH:mm` (24h). */
export type LocalTime = string;

export interface AuditInfo {
  createdAt: Date;
  updatedAt: Date;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface PageRequest {
  limit?: number;
  offset?: number;
}

/** Riferimento minimo a un utente, usato per autori, recruiter, assegnatari. */
export interface UserRef {
  id: EntityId;
  displayName: string;
}
