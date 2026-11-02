import type { EntityId } from "./shared";

/** Eventi che generano una notifica per gli utenti HR. */
export const NOTIFICATION_KINDS = ["CAREER_APPLICATION"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Notifica personale: ogni utente ha la sua copia e la segna come letta per conto proprio. */
export interface Notification {
  id: EntityId;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Percorso interno dell'app da aprire (mai un URL esterno). */
  href: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  candidateId: EntityId | null;
}
