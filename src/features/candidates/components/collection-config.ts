import {
  ACTIVE_POLICY_PROGRAM_LABELS,
  ACTIVE_POLICY_STATUS_LABELS,
  DRIVING_LICENSE_LABELS,
  EDUCATION_LEVEL_LABELS,
  LANGUAGE_LEVEL_LABELS,
  labelOf,
  optionsOf,
} from "@/config/labels";
import { getExperienceDurationMonths } from "@/domain";
import type { CandidateCollectionKind, CandidateCollections } from "@/repositories/types";
import { formatMonths, formatNumericDate } from "@/lib/format";
import { toFormValue } from "@/lib/zod-helpers";

export type FieldDescriptor =
  | {
      name: string;
      label: string;
      type: "text" | "textarea" | "date" | "number";
      required?: boolean;
      description?: string;
      maxLength?: number;
      wide?: boolean;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: Array<{ value: string; label: string }>;
      required?: boolean;
      wide?: boolean;
    }
  | { name: string; label: string; type: "checkbox"; description?: string; wide?: boolean };

export interface CollectionConfig<K extends CandidateCollectionKind> {
  title: string;
  itemLabel: string;
  emptyText: string;
  fields: FieldDescriptor[];
  defaults: Record<string, string | boolean>;
  toForm: (item: CandidateCollections[K]) => Record<string, string | boolean>;
  summary: (item: CandidateCollections[K]) => { title: string; subtitle?: string | null; meta?: string | null };
}

type Configs = { [K in CandidateCollectionKind]: CollectionConfig<K> };

/** Configurazione dichiarativa delle collezioni del profilo (form + riepilogo). */
export const COLLECTION_CONFIG: Configs = {
  experiences: {
    title: "Esperienze professionali",
    itemLabel: "esperienza",
    emptyText: "Nessuna esperienza registrata.",
    fields: [
      { name: "roleTitle", label: "Ruolo", type: "text", required: true, maxLength: 160 },
      { name: "companyName", label: "Azienda", type: "text", required: true, maxLength: 160 },
      { name: "sector", label: "Settore", type: "text", maxLength: 100 },
      { name: "startDate", label: "Inizio", type: "date", required: true },
      { name: "endDate", label: "Fine", type: "date", description: "Lascia vuoto se in corso" },
      { name: "currentRole", label: "Ruolo attuale", type: "checkbox", wide: true },
      { name: "description", label: "Descrizione", type: "textarea", maxLength: 2000, wide: true },
    ],
    defaults: {
      roleTitle: "",
      companyName: "",
      sector: "",
      startDate: "",
      endDate: "",
      currentRole: false,
      description: "",
    },
    toForm: (item) => ({
      roleTitle: item.roleTitle,
      companyName: item.companyName,
      sector: toFormValue(item.sector),
      startDate: item.startDate,
      endDate: toFormValue(item.endDate),
      currentRole: item.currentRole,
      description: toFormValue(item.description),
    }),
    summary: (item) => ({
      title: item.roleTitle,
      subtitle: [item.companyName, item.sector].filter(Boolean).join(" · "),
      meta: `${formatNumericDate(item.startDate)} – ${item.currentRole || !item.endDate ? "in corso" : formatNumericDate(item.endDate)} · ${formatMonths(getExperienceDurationMonths(item))}`,
    }),
  },
  education: {
    title: "Istruzione",
    itemLabel: "titolo di studio",
    emptyText: "Nessun titolo di studio registrato.",
    fields: [
      { name: "qualification", label: "Titolo", type: "text", required: true, maxLength: 200, wide: true },
      { name: "level", label: "Livello", type: "select", options: optionsOf(EDUCATION_LEVEL_LABELS), required: true },
      { name: "year", label: "Anno di conseguimento", type: "number" },
      { name: "fieldOfStudy", label: "Indirizzo di studio", type: "text", maxLength: 160 },
      { name: "institution", label: "Istituto", type: "text", maxLength: 200 },
      { name: "notes", label: "Note", type: "textarea", maxLength: 1000, wide: true },
    ],
    defaults: { qualification: "", level: "UPPER_SECONDARY", year: "", fieldOfStudy: "", institution: "", notes: "" },
    toForm: (item) => ({
      qualification: item.qualification,
      level: item.level,
      year: toFormValue(item.year),
      fieldOfStudy: toFormValue(item.fieldOfStudy),
      institution: toFormValue(item.institution),
      notes: toFormValue(item.notes),
    }),
    summary: (item) => ({
      title: item.qualification,
      subtitle: [labelOf(EDUCATION_LEVEL_LABELS, item.level), item.fieldOfStudy].filter(Boolean).join(" · "),
      meta: [item.institution, item.year].filter(Boolean).join(" · ") || null,
    }),
  },
  interests: {
    title: "Settori di interesse",
    itemLabel: "settore",
    emptyText: "Nessun settore di interesse indicato.",
    fields: [
      { name: "sector", label: "Settore", type: "text", required: true, maxLength: 100 },
      { name: "priority", label: "Priorità (1 = massima)", type: "number" },
    ],
    defaults: { sector: "", priority: "" },
    toForm: (item) => ({ sector: item.sector, priority: toFormValue(item.priority) }),
    summary: (item) => ({ title: item.sector, meta: item.priority ? `Priorità ${item.priority}` : null }),
  },
  languages: {
    title: "Lingue",
    itemLabel: "lingua",
    emptyText: "Nessuna lingua indicata.",
    fields: [
      { name: "language", label: "Lingua", type: "text", required: true, maxLength: 60 },
      { name: "level", label: "Livello", type: "select", options: optionsOf(LANGUAGE_LEVEL_LABELS), required: true },
      { name: "certified", label: "Livello certificato", type: "checkbox", wide: true },
      { name: "notes", label: "Note", type: "textarea", maxLength: 500, wide: true },
    ],
    defaults: { language: "", level: "B1", certified: false, notes: "" },
    toForm: (item) => ({
      language: item.language,
      level: item.level,
      certified: item.certified,
      notes: toFormValue(item.notes),
    }),
    summary: (item) => ({
      title: item.language,
      subtitle: labelOf(LANGUAGE_LEVEL_LABELS, item.level),
      meta: item.certified ? "Certificato" : null,
    }),
  },
  certifications: {
    title: "Certificazioni",
    itemLabel: "certificazione",
    emptyText: "Nessuna certificazione registrata.",
    fields: [
      { name: "name", label: "Certificazione", type: "text", required: true, maxLength: 200, wide: true },
      { name: "issuer", label: "Ente rilasciante", type: "text", maxLength: 160 },
      { name: "credentialId", label: "Codice attestato", type: "text", maxLength: 120 },
      { name: "issuedAt", label: "Data rilascio", type: "date" },
      { name: "expiresAt", label: "Scadenza", type: "date" },
      { name: "notes", label: "Note", type: "textarea", maxLength: 500, wide: true },
    ],
    defaults: { name: "", issuer: "", credentialId: "", issuedAt: "", expiresAt: "", notes: "" },
    toForm: (item) => ({
      name: item.name,
      issuer: toFormValue(item.issuer),
      credentialId: toFormValue(item.credentialId),
      issuedAt: toFormValue(item.issuedAt),
      expiresAt: toFormValue(item.expiresAt),
      notes: toFormValue(item.notes),
    }),
    summary: (item) => ({
      title: item.name,
      subtitle: item.issuer,
      meta:
        [
          item.issuedAt && `Rilascio ${formatNumericDate(item.issuedAt)}`,
          item.expiresAt && `Scadenza ${formatNumericDate(item.expiresAt)}`,
        ]
          .filter(Boolean)
          .join(" · ") || null,
    }),
  },
  drivingLicenses: {
    title: "Patenti e abilitazioni",
    itemLabel: "patente",
    emptyText: "Nessuna patente indicata.",
    fields: [
      {
        name: "category",
        label: "Categoria",
        type: "select",
        options: optionsOf(DRIVING_LICENSE_LABELS),
        required: true,
      },
      { name: "valid", label: "In corso di validità", type: "checkbox" },
      { name: "notes", label: "Note", type: "textarea", maxLength: 500, wide: true },
    ],
    defaults: { category: "B", valid: true, notes: "" },
    toForm: (item) => ({ category: item.category, valid: item.valid, notes: toFormValue(item.notes) }),
    summary: (item) => ({
      title: labelOf(DRIVING_LICENSE_LABELS, item.category),
      meta: item.valid ? "Valida" : "Non valida / scaduta",
    }),
  },
  activePolicies: {
    title: "Politiche attive",
    itemLabel: "partecipazione",
    emptyText: "Nessuna partecipazione a politiche attive.",
    fields: [
      {
        name: "programType",
        label: "Programma",
        type: "select",
        options: optionsOf(ACTIVE_POLICY_PROGRAM_LABELS),
        required: true,
      },
      { name: "referenceYear", label: "Anno di riferimento", type: "number", required: true },
      { name: "status", label: "Stato", type: "select", options: optionsOf(ACTIVE_POLICY_STATUS_LABELS) },
      { name: "notes", label: "Note", type: "textarea", maxLength: 500, wide: true },
    ],
    defaults: { programType: "GOL", referenceYear: String(new Date().getFullYear()), status: "", notes: "" },
    toForm: (item) => ({
      programType: item.programType,
      referenceYear: String(item.referenceYear),
      status: toFormValue(item.status),
      notes: toFormValue(item.notes),
    }),
    summary: (item) => ({
      title: labelOf(ACTIVE_POLICY_PROGRAM_LABELS, item.programType),
      subtitle: String(item.referenceYear),
      meta: item.status ? labelOf(ACTIVE_POLICY_STATUS_LABELS, item.status) : null,
    }),
  },
};
