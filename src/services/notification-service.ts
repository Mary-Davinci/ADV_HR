import type { EntityId, Notification } from "@/domain";

import type { ServiceContext } from "./context";

/** Quante notifiche mostrare nel pannello della campanella. */
export const NOTIFICATIONS_SHOWN = 20;

/**
 * Notifiche dell'utente collegato. Nessun permesso aggiuntivo: ognuno vede e
 * segna come lette soltanto le proprie (il filtro per utente è nel repository).
 */
export function createNotificationService(context: ServiceContext) {
  const { store, actor } = context;
  return {
    async overview(): Promise<{ unread: number; items: Notification[] }> {
      const [unread, items] = await Promise.all([
        store.notifications.countUnread(actor.id),
        store.notifications.listForUser(actor.id, NOTIFICATIONS_SHOWN),
      ]);
      return { unread, items };
    },

    /** Senza `ids` segna come lette tutte le notifiche. */
    markRead(ids?: EntityId[]): Promise<void> {
      return store.notifications.markRead(actor.id, ids);
    },
  };
}
