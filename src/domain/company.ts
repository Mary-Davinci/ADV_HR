import type { AuditInfo, EntityId } from "./shared";

/** Origine del record. `ADV_CORE` è riservato al futuro bridge (non implementato). */
export const COMPANY_SOURCES = ["ADV_HR", "ADV_CORE"] as const;
export type CompanySource = (typeof COMPANY_SOURCES)[number];

export interface Company extends AuditInfo {
  id: EntityId;
  name: string;
  vatNumber: string | null;
  fiscalCode: string | null;
  sector: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: CompanySource;
}
