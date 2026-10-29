/**
 * Traduzione dei record ADV CORE nel modello ADV_HR e merge a tre vie.
 * Funzioni pure: nessun accesso a database o rete.
 */
import type { ActivePolicyProgram, EducationLevel, EmploymentStatus, Gender, WorkMode, WorkTime } from "@/domain";

import type { AdvCoreCandidate, AdvCoreCompany } from "./client";

/** Da incrementare quando cambia il mapping: forza la rielaborazione di tutti i record. */
export const MAPPING_VERSION = 3;

export type FieldValue = string | number | boolean | null;
/** Campi piatti "tabella.campo" (es. "candidate.email", "profile.residenceCity"). */
export type FieldMap = Record<string, FieldValue>;
export type Conflicts = Record<string, { hr: FieldValue; advCore: FieldValue }>;

/* ------------------------------------------------------------------ */
/* Normalizzazione                                                     */
/* ------------------------------------------------------------------ */

export function cleanText(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text.slice(0, max);
}

/** Testo multilinea: conserva gli a capo, ripulisce il resto. */
export function cleanLongText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text === "" ? null : text;
}

export function normalizeFiscalCode(value: unknown): string | null {
  const code = cleanText(value, 32)?.toUpperCase().replace(/\s/g, "") ?? null;
  return code && /^[A-Z0-9]{16}$/.test(code) ? code : null;
}

export function normalizeVatNumber(value: unknown): string | null {
  const digits = (cleanText(value, 32) ?? "").replace(/^IT/i, "").replace(/[\s.]/g, "");
  return /^\d{11}$/.test(digits) ? digits : null;
}

export function normalizeCompanyFiscalCode(value: unknown): string | null {
  const code = cleanText(value, 32)?.toUpperCase().replace(/\s/g, "") ?? null;
  return code && /^([A-Z0-9]{16}|\d{11})$/.test(code) ? code : null;
}

export function normalizeEmail(value: unknown): string | null {
  const email = cleanText(value, 254)?.toLowerCase() ?? null;
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Data "YYYY-MM-DD" plausibile (non futura, dopo il 1900), altrimenti null. */
export function normalizeDate(value: unknown, today: Date): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(d)) return null;
  if (Number(y) < 1900 || date.getTime() > today.getTime()) return null;
  return `${y}-${m}-${d}`;
}

const LOWERCASE_WORDS = new Set(["e", "di", "del", "della", "dei", "degli", "delle"]);

/** "BASILICATA" → "Basilicata", "valle d'aosta" → "Valle d'Aosta", "EMILIA-ROMAGNA" → "Emilia-Romagna". */
export function titleCase(value: string | null): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word
        .split("-")
        .map((part) =>
          part.replace(
            /^(d')?(\p{L})/u,
            (_, prefix: string | undefined, first: string) => (prefix ?? "") + first.toUpperCase(),
          ),
        )
        .join("-");
    })
    .join(" ");
}

function yesNo(value: unknown): boolean | null {
  const text = cleanText(value, 10)?.toLowerCase();
  if (text === "si" || text === "sì" || text === "yes") return true;
  if (text === "no") return false;
  return null;
}

export function mapGender(value: unknown): Gender {
  const text = cleanText(value, 20)?.toLowerCase() ?? "";
  if (["uomo", "m", "maschio", "maschile"].includes(text)) return "MALE";
  if (["donna", "f", "femmina", "femminile"].includes(text)) return "FEMALE";
  return "NOT_SPECIFIED";
}

export function mapEmploymentStatus(value: unknown): EmploymentStatus {
  const text = cleanText(value, 100)?.toLowerCase() ?? "";
  if (!text) return "UNKNOWN";
  // L'ordine conta: "disoccupato" contiene "occupat".
  if (/disoccup|inoccup|naspi|\brdc\b|dis-coll|\badi\b|\bsfl\b/.test(text)) return "UNEMPLOYED";
  if (/neet/.test(text)) return "INACTIVE";
  if (/occupat|working poor|partita iva|sospes/.test(text)) return "EMPLOYED";
  return "UNKNOWN";
}

export function mapWorkTime(value: unknown): WorkTime | null {
  const text = cleanText(value, 100)?.toLowerCase() ?? "";
  const full = /full|tempo pieno/.test(text);
  const part = /part|tempo parziale/.test(text);
  if (full && part) return "EITHER";
  if (full) return "FULL_TIME";
  if (part) return "PART_TIME";
  return null;
}

export function mapWorkMode(value: unknown): WorkMode | null {
  const text = cleanText(value, 100)?.toLowerCase() ?? "";
  if (/ibrid/.test(text)) return "HYBRID";
  if (/remot|smart|distanza/.test(text)) return "REMOTE";
  if (/indifferent|flessib/.test(text)) return "FLEXIBLE";
  if (/presenza|in sede/.test(text)) return "ONSITE";
  return null;
}

export function mapEducationLevel(value: unknown): EducationLevel | null {
  const text = cleanText(value, 200)?.toLowerCase() ?? "";
  if (!text || /nessun/.test(text)) return null;
  if (/dottorat/.test(text)) return "DOCTORATE";
  if (/magistral|specialistic|vecchio ordinamento|master/.test(text)) return "MASTER";
  if (/laurea|triennal|universit/.test(text)) return "BACHELOR";
  if (/\bits\b|\bifts\b|post.?diploma/.test(text)) return "POST_SECONDARY";
  if (/qualifica|professional/.test(text)) return "VOCATIONAL";
  if (/diploma|superior|maturit|secondo grado/.test(text)) return "UPPER_SECONDARY";
  if (/media|primo grado|terza/.test(text)) return "LOWER_SECONDARY";
  return "OTHER";
}

/** Prefisso delle note che identifica la politica attiva gestita dalla sincronizzazione. */
export const ADV_CORE_POLICY_NOTE_PREFIX = "ADV Core: ";

export function mapActivePolicyProgram(value: unknown): ActivePolicyProgram | null {
  const text = cleanText(value, 100)?.toLowerCase() ?? "";
  if (!text || /nessun/.test(text)) return null;
  if (/\bgol\b/.test(text)) return "GOL";
  if (/\bdil\b/.test(text)) return "DIL";
  if (/garanzia giovani/.test(text)) return "GARANZIA_GIOVANI";
  if (/dote unica|\bdul\b/.test(text)) return "DOTE_UNICA_LAVORO";
  if (/tirocin/.test(text)) return "TIROCINIO";
  if (/ricolloc/.test(text)) return "ASSEGNO_RICOLLOCAZIONE";
  return "OTHER";
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

export interface MappedCandidate {
  fields: FieldMap;
  /** Titolo di studio: creato solo alla prima importazione (vedi docs). */
  education: { qualification: string; level: EducationLevel } | null;
  /**
   * Politica attiva dichiarata in ADV CORE, riallineata a ogni sincronizzazione
   * (riconosciuta dal prefisso nelle note): quelle inserite in ADV_HR non si toccano.
   */
  activePolicy: { programType: ActivePolicyProgram; referenceYear: number; notes: string } | null;
}

export function mapCandidate(row: AdvCoreCandidate, today: Date): MappedCandidate {
  const fields: FieldMap = {
    "candidate.firstName": cleanText(row.nome, 100) ?? "N/D",
    "candidate.lastName": cleanText(row.cognome, 100) ?? "N/D",
    "candidate.fiscalCode": normalizeFiscalCode(row.codice_fiscale),
    "candidate.email": normalizeEmail(row.email),
    "candidate.phone": cleanText(row.cellulare ?? row.telefono ?? row.telefono_2, 40),
    "candidate.birthDate": normalizeDate(row.nato_il, today),
    "candidate.gender": mapGender(row.sesso),
    "profile.residenceAddress": cleanText(row.indirizzo, 200),
    "profile.residenceCity": cleanText(row.comune, 100),
    "profile.residenceProvince": cleanText(row.provincia_sigla, 2)?.toUpperCase() ?? null,
    "profile.residenceRegion": titleCase(cleanText(row.regione, 60)),
    "profile.employmentStatus": mapEmploymentStatus(row.stato_occupazionale),
    "profile.professionalSummary": cleanLongText(row.profilo_professionale),
    "preferences.desiredWorkTime": mapWorkTime(row.tipologia_contrattuale),
    "preferences.desiredWorkMode": mapWorkMode(row.modalita_lavoro),
    "preferences.willingToRelocate": yesNo(row.disponibilita_trasferimento),
    "preferences.willingToTravel": yesNo(row.disponibilita_trasferte),
  };

  // Dati particolari: solo se ADV CORE li espone (decisione legale). Non deduciamo l'articolo
  // della L. 68/99, che ADV CORE non registra: il valore originale va nelle note.
  if (row.dati_protetti) {
    const parts = [
      row.dati_protetti.collocamento_mirato ? `Collocamento mirato: ${row.dati_protetti.collocamento_mirato}` : null,
      row.dati_protetti.soggetto_svantaggiato
        ? `Soggetto svantaggiato: ${row.dati_protetti.soggetto_svantaggiato}`
        : null,
    ].filter(Boolean);
    fields["profile.protectedCategoryNotes"] = parts.length ? `ADV Core - ${parts.join("; ")}` : null;
  }

  const qualification = cleanText(row.titolo_studio, 200);
  const level = mapEducationLevel(row.titolo_studio);
  return {
    fields,
    education: qualification && level ? { qualification, level } : null,
    activePolicy: mapActivePolicy(row, today),
  };
}

function mapActivePolicy(row: AdvCoreCandidate, today: Date): MappedCandidate["activePolicy"] {
  const label = cleanText(row.politiche_attive_tipologia, 100);
  const programType = mapActivePolicyProgram(label);
  if (!label || !programType) return null;
  const declared = Number(String(row.politiche_attive_anno ?? "").trim());
  // Anno mancante o non valido (es. "test"): si usa l'anno di inserimento della scheda.
  const inserted = normalizeDate(row.data_inserimento, today);
  const referenceYear =
    Number.isInteger(declared) && declared >= 2000 && declared <= today.getFullYear() + 1
      ? declared
      : inserted
        ? Number(inserted.slice(0, 4))
        : null;
  if (!referenceYear) return null;
  return { programType, referenceYear, notes: `${ADV_CORE_POLICY_NOTE_PREFIX}${label}` };
}

export function mapCompany(row: AdvCoreCompany): FieldMap {
  const notes = [cleanLongText(row.informazioni), cleanLongText(row.annotazioni)].filter(Boolean).join("\n\n");
  return {
    "company.name": cleanText(row.denominazione, 200) ?? "N/D",
    "company.vatNumber": normalizeVatNumber(row.partita_iva),
    "company.fiscalCode": normalizeCompanyFiscalCode(row.codice_fiscale),
    "company.sector": cleanText(row.codice_ateco, 100),
    "company.city": cleanText(row.comune, 100),
    "company.province": cleanText(row.provincia_sigla, 2)?.toUpperCase() ?? null,
    "company.region": titleCase(cleanText(row.regione, 60)),
    "company.email": normalizeEmail(row.email) ?? normalizeEmail(row.pec),
    "company.phone": cleanText(row.telefono ?? row.cellulare, 40),
    "company.notes": notes || null,
  };
}

/* ------------------------------------------------------------------ */
/* Merge a tre vie                                                     */
/* ------------------------------------------------------------------ */

export interface MergeResult {
  /** Campi da scrivere in ADV_HR. */
  updates: FieldMap;
  /** Nuova base: valori ADV CORE considerati "importati". */
  base: FieldMap;
  conflicts: Conflicts;
}

const same = (a: FieldValue | undefined, b: FieldValue | undefined) => (a ?? null) === (b ?? null);

/**
 * Regola concordata: se un campo è stato modificato in ADV_HR vince ADV_HR,
 * e se ADV CORE ha un valore diverso il campo viene segnalato come conflitto.
 *
 * - `current`  valori attuali in ADV_HR
 * - `base`     valori scritti all'ultima importazione (null = record ADV_HR preesistente
 *              appena collegato, senza storia di importazione)
 * - `incoming` valori attuali in ADV CORE
 */
export function mergeFields(
  current: FieldMap,
  base: FieldMap | null,
  incoming: FieldMap,
  previousConflicts: Conflicts = {},
): MergeResult {
  const updates: FieldMap = {};
  const newBase: FieldMap = {};
  const conflicts: Conflicts = {};

  for (const [key, advCore] of Object.entries(incoming)) {
    const hr = current[key] ?? null;
    const hasBase = base !== null && key in base;

    if (!hasBase) {
      // Nessuna storia: si riempiono solo i campi vuoti, le differenze sono conflitti.
      if (hr === null && advCore !== null) updates[key] = advCore;
      else if (!same(hr, advCore)) conflicts[key] = { hr, advCore };
      newBase[key] = advCore;
      continue;
    }

    const imported = base[key] ?? null;
    if (same(hr, imported)) {
      // Campo mai toccato in ADV_HR: segue ADV CORE.
      if (!same(hr, advCore)) updates[key] = advCore;
      newBase[key] = advCore;
    } else if (same(hr, advCore)) {
      // Modificato in ADV_HR ma ora coincide con ADV CORE.
      newBase[key] = advCore;
    } else if (same(advCore, imported)) {
      // Modificato solo in ADV_HR: resta, si conserva l'eventuale conflitto già aperto.
      newBase[key] = imported;
      if (previousConflicts[key]) conflicts[key] = { hr, advCore: previousConflicts[key].advCore };
    } else {
      // Modificato da entrambe le parti: vince ADV_HR, si segnala.
      conflicts[key] = { hr, advCore };
      newBase[key] = advCore;
    }
  }
  return { updates, base: newBase, conflicts };
}
