/**
 * Riferimenti ai sistemi legacy. ADV CORE è importato in sola lettura dalla
 * sincronizzazione pianificata: vedi docs/ADV_CORE_BRIDGE.md.
 */
export const LEGACY_SYSTEMS = ["ADV_CORE"] as const;
export type LegacySystem = (typeof LEGACY_SYSTEMS)[number];

export const LEGACY_ENTITY_TYPES = ["CANDIDATE", "COMPANY", "USER", "DOCUMENT", "APPLICATION"] as const;
export type LegacyEntityType = (typeof LEGACY_ENTITY_TYPES)[number];

/** Esito di un'esecuzione della sincronizzazione ADV CORE. */
export const ADV_CORE_SYNC_STATUSES = [
  "RUNNING",
  /** Tutto importato. */
  "SUCCESS",
  /** Importazione eseguita ma con errori su singoli record o elenco incompleto. */
  "PARTIAL",
  /** Sincronizzazione interrotta (API irraggiungibile, configurazione errata, ...). */
  "FAILED",
] as const;
export type AdvCoreSyncStatus = (typeof ADV_CORE_SYNC_STATUSES)[number];

export const ADV_CORE_SYNC_TRIGGERS = ["SCHEDULED", "MANUAL"] as const;
export type AdvCoreSyncTrigger = (typeof ADV_CORE_SYNC_TRIGGERS)[number];
