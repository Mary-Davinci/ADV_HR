import { professionSearchStem } from "@/domain";

/**
 * Parole chiave di una posizione aperta, ricavate dal titolo della selezione
 * (la figura cercata) e dai requisiti della job description. Trasparenti:
 * vengono mostrate a HR insieme ai candidati trovati.
 */
export interface PositionKeywords {
  /** Dal titolo: il candidato deve averne almeno una per essere compatibile. */
  role: string[];
  /** Da requisiti e mansioni: non obbligatorie, migliorano l'ordinamento. */
  bonus: string[];
}

/** Parole che non distinguono una figura professionale dall'altra. */
const STOPWORDS = new Set(
  `a ad al alla alle allo agli ai anche che chi con da dal dalla dalle dei del della delle dello degli di e ed
  fra gli i il in la le lo nei nel nella nelle nello o per più piu se senza su sul sulla sui tra un una uno
  dell all dall nell sull coll quell
  addetto addetta addetti addette operatore operatrice figura risorsa risorse ruolo profilo posizione cercasi
  cerchiamo ricerca ricerchiamo selezione junior senior stage stagista tirocinio tirocinante apprendista
  tempo determinato indeterminato full part time contratto sede zona provincia anni anno mesi esperienza
  esperienze esperto esperta capacità capacita conoscenza conoscenze competenze competenza buona buone
  ottima ottime ottimo base requisiti requisito richiesto richiesta richiesti preferibile gradita gradito
  disponibilità disponibilita lavoro attività attivita gestione mansioni mansione azienda aziendale clienti
  cliente interno interna generale generali turni turno patente automunito automunita livello eventuale
  posto posti persona persone unita`
    .split(/\s+/)
    .filter(Boolean),
);

const MAX_ROLE_KEYWORDS = 6;
const MAX_BONUS_KEYWORDS = 10;

function words(text: string | null | undefined, exclude: Set<string>): string[] {
  return (text ?? "")
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase())
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !STOPWORDS.has(word) && !exclude.has(word));
}

export function positionKeywords(input: {
  titles: Array<string | null | undefined>;
  requirements: Array<string | null | undefined>;
  /** Luoghi (città dell'azienda, sede di lavoro): nel titolo non descrivono la figura. */
  places?: Array<string | null | undefined>;
}): PositionKeywords {
  const exclude = new Set((input.places ?? []).flatMap((place) => words(place, new Set())));
  const seenStems = new Set<string>();
  const pick = (texts: Array<string | null | undefined>, max: number) => {
    const picked: string[] = [];
    for (const word of texts.flatMap((text) => words(text, exclude))) {
      const stem = professionSearchStem(word);
      if (seenStems.has(stem)) continue;
      seenStems.add(stem);
      picked.push(word);
      if (picked.length >= max) break;
    }
    return picked;
  };
  const role = pick(input.titles, MAX_ROLE_KEYWORDS);
  return { role, bonus: pick(input.requirements, MAX_BONUS_KEYWORDS) };
}
