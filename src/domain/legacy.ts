/**
 * Riferimenti per il futuro bridge verso sistemi legacy.
 * NESSUNA integrazione è implementata: vedi docs/ADV_CORE_BRIDGE.md.
 */
export const LEGACY_SYSTEMS = ["ADV_CORE"] as const;
export type LegacySystem = (typeof LEGACY_SYSTEMS)[number];

export const LEGACY_ENTITY_TYPES = ["CANDIDATE", "COMPANY", "USER", "DOCUMENT", "APPLICATION"] as const;
export type LegacyEntityType = (typeof LEGACY_ENTITY_TYPES)[number];
