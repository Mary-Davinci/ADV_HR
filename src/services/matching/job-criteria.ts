import type { EducationLevel, JobRequestForm } from "@/domain";

/**
 * Criteri di ricerca ricavati dal modulo Job Description, in forma
 * trasparente: zona, livello di istruzione minimo, parole chiave da cercare
 * nel testo dei CV. Nessun peso nascosto (vedi docs/MATCHING.md).
 */
export interface JobSearchCriteria {
  province: string;
  city: string;
  minEducationLevel: EducationLevel | null;
  /** Parole chiave normalizzate (minuscole, solo lettere e cifre). */
  keywords: string[];
}

/** Ordine dei livelli di istruzione (OTHER non è confrontabile). */
export const EDUCATION_ORDER: readonly EducationLevel[] = [
  "LOWER_SECONDARY",
  "VOCATIONAL",
  "UPPER_SECONDARY",
  "POST_SECONDARY",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
];

/** Livello minimo dichiarato nel campo libero "Istruzione" del modulo. */
export function requiredEducationLevel(text: string | null): EducationLevel | null {
  if (!text) return null;
  const value = text.toLowerCase();
  if (/dottorato|phd/.test(value)) return "DOCTORATE";
  if (/laurea\s+(magistrale|specialistica)|master/.test(value)) return "MASTER";
  if (/laurea|universit/.test(value)) return "BACHELOR";
  if (/\bits\b|\bifts\b|post.?diploma/.test(value)) return "POST_SECONDARY";
  if (/diploma|maturit|superior/.test(value)) return "UPPER_SECONDARY";
  if (/qualifica|professional|\bifp\b|\biefp\b/.test(value)) return "VOCATIONAL";
  if (/licenza\s+media|scuola\s+media|obbligo/.test(value)) return "LOWER_SECONDARY";
  return null;
}

export function educationSatisfies(candidate: EducationLevel | null, required: EducationLevel | null): boolean | null {
  if (!required) return null;
  if (!candidate || candidate === "OTHER") return null;
  return EDUCATION_ORDER.indexOf(candidate) >= EDUCATION_ORDER.indexOf(required);
}

/** Parole troppo generiche per distinguere un CV dall'altro. */
const STOPWORDS = new Set(
  `a ad al alla alle allo agli ai anche che chi con da dal dalla dalle dei del della delle dello degli di e ed
  fra gli i il in la le lo nei nel nella nelle nello o per più se senza su sul sulla sui tra un una uno
  base buona buone buon ottima ottime ottimo capacità conoscenza conoscenze competenze competenza esperienza
  disponibilità disponibile richiesta richiesto richiesti requisiti requisito preferibile gradita gradito
  lavoro lavori attività gestione mansioni mansione ruolo figura risorsa addetto addetta ecc eventuale eventuali
  livello anni anno mesi turni turno sede azienda aziendale clienti cliente interno interna generale generali
  uno due tre quattro cinque sei sette otto nove dieci primo prima secondo seconda`
    .split(/\s+/)
    .filter(Boolean),
);

const MAX_KEYWORDS = 15;

export function jobKeywords(form: JobRequestForm): string[] {
  const sources = [
    form.profile.role,
    form.profile.duties,
    form.profile.activities,
    form.profile.mandatoryRequirements,
    form.profile.certifications,
  ];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const raw of (source ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      const word = raw.normalize("NFD").replace(/\p{M}/gu, "");
      if (word.length < 3 || /^\d+$/.test(word) || STOPWORDS.has(word) || STOPWORDS.has(raw)) continue;
      seen.add(word);
      if (seen.size >= MAX_KEYWORDS) return [...seen];
    }
  }
  return [...seen];
}

export function searchCriteria(form: JobRequestForm): JobSearchCriteria {
  return {
    province: form.profile.province,
    city: form.profile.city,
    minEducationLevel: requiredEducationLevel(form.profile.education),
    keywords: jobKeywords(form),
  };
}
