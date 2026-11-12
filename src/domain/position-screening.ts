import { professionSearchStem } from "./candidate";

export interface PositionScreening {
  functionPattern: string | null;
  domainPattern: string | null;
  otherDomainPattern: string | null;
  functionLabels: string[];
  domainLabels: string[];
  functions: Array<{ label: string; pattern: string }>;
  domains: Array<{ label: string; pattern: string }>;
}

export const POSITION_FILTER_FLAGS = [
  "near",
  "experienced",
  "readableCv",
  "license",
  "policy",
  "noPolicy",
  "orientation",
] as const;
export type PositionFilterFlag = (typeof POSITION_FILTER_FLAGS)[number];
export interface PositionMatchFilters {
  region?: string;
  flags?: PositionFilterFlag[];
}
export interface PositionMatchFacets {
  regions: Array<{ value: string; count: number }>;
  counts: Record<PositionFilterFlag, number>;
}

export function parsePositionMatchFilters(raw: Record<string, string | string[] | undefined>): PositionMatchFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const requested = new Set((first(raw.match) ?? "").split(","));
  const flags = POSITION_FILTER_FLAGS.filter((flag) => requested.has(flag));
  // URL manomesse: le due condizioni opposte non possono essere attive insieme.
  const valid = flags.includes("policy") ? flags.filter((flag) => flag !== "noPolicy") : flags;
  return { region: first(raw.matchRegion)?.trim().slice(0, 80) || undefined, flags: valid };
}

interface Concept {
  label: string;
  aliases: string[];
  descriptionAliases?: string[];
  area?: string;
}

// Vocabolario esplicito: sinonimi controllati, nessuna classificazione automatica del candidato.
const FUNCTIONS: Concept[] = [
  {
    label: "Progettazione",
    aliases: ["progettista", "progettazione", "disegnatore", "disegno tecnico", "disegno CAD"],
  },
  { label: "Vendite", aliases: ["commerciale", "venditore", "vendita", "sales", "agente commerciale"] },
  { label: "Magazzino", aliases: ["magazziniere", "magazzino", "carrellista"] },
  { label: "Guida professionale", aliases: ["autista", "conducente", "camionista"] },
  { label: "Contabilità", aliases: ["contabile", "contabilità", "ragioniere", "accounting"] },
  { label: "Manutenzione", aliases: ["manutentore", "manutenzione"] },
  { label: "Sviluppo software", aliases: ["sviluppatore", "programmatore", "software developer", "sviluppo software"] },
  { label: "Cucina", aliases: ["cuoco", "chef", "aiuto cuoco"] },
];

const DOMAINS: Concept[] = [
  {
    label: "Elettrico",
    area: "impianti",
    aliases: ["elettrico", "elettricista", "elettrotecnico", "elettromeccanico", "quadrista"],
  },
  {
    label: "Termoidraulico",
    area: "impianti",
    aliases: [
      "idraulico",
      "termoidraulico",
      "termotecnico",
      "riscaldamento",
      "climatizzazione",
      "HVAC",
      "termo idraulico",
    ],
  },
  { label: "Meccanico", area: "industria", aliases: ["meccanico", "metalmeccanico", "meccatronico", "CNC"] },
  {
    label: "Edile",
    area: "edilizia",
    aliases: ["edile", "edilizia", "muratore", "architettonico", "ingegneria civile"],
  },
  {
    label: "Software",
    area: "digitale",
    aliases: ["software", "informatico", "informatica", "programmatore", "sviluppatore"],
    descriptionAliases: [
      "sviluppo software",
      "progettazione software",
      "sistemi informatici",
      "programmazione",
      "sviluppatore",
    ],
  },
  { label: "Grafica", area: "comunicazione", aliases: ["grafico", "grafica", "graphic designer", "web designer"] },
  {
    label: "Sanitario",
    area: "sanita",
    aliases: ["infermiere", "infermieristico", "sanitario", "OSS", "fisioterapista"],
  },
  {
    label: "Alimentare",
    area: "alimentare",
    aliases: ["alimentare", "panificatore", "pasticciere", "pasticcere", "ristorazione"],
  },
];

export function normalizeProfessionText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Parole intere e flessioni brevi: commerciale non diventa commercialista. */
export function professionPattern(aliases: string[]): string | null {
  const patterns = [...new Set(aliases)].map((alias) =>
    normalizeProfessionText(alias)
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `${professionSearchStem(word)}${word.length >= 5 ? "[a-z]{0,2}" : ""}`)
      .join("[[:space:]]+"),
  );
  return patterns.length ? `\\m(${patterns.join("|")})\\M` : null;
}

function mentioned(text: string, aliases: string[]): boolean {
  const pattern = professionPattern(aliases);
  return (
    !!pattern &&
    new RegExp(pattern.replaceAll("\\m", "\\b").replaceAll("\\M", "\\b").replaceAll("[[:space:]]", "\\s")).test(
      normalizeProfessionText(text),
    )
  );
}

export function buildPositionScreening(input: {
  titles: Array<string | null | undefined>;
  descriptions: Array<string | null | undefined>;
  fallbackKeywords: string[];
}): PositionScreening {
  const title = input.titles.filter(Boolean).join(" ");
  const description = input.descriptions.filter(Boolean).join(" ");
  let functions = FUNCTIONS.filter((concept) => mentioned(title, concept.aliases));
  // La JD precisa un titolo generico; non sostituisce un mestiere già indicato nel titolo.
  if (
    !functions.length &&
    input.fallbackKeywords.every((word) =>
      /^(operai|tecnic|impiegat|responsabil|ingegner|perit|impiant|personal)/.test(professionSearchStem(word)),
    )
  ) {
    functions = FUNCTIONS.filter((concept) => mentioned(description, concept.aliases));
  }
  const titleDomains = DOMAINS.filter((concept) => mentioned(title, concept.aliases));
  const descriptionDomains = DOMAINS.filter((concept) =>
    mentioned(description, concept.descriptionAliases ?? concept.aliases),
  );
  const domains = titleDomains.length
    ? [
        ...titleDomains,
        ...descriptionDomains.filter(
          (concept) => titleDomains.some((known) => known.area === concept.area) && !titleDomains.includes(concept),
        ),
      ]
    : descriptionDomains;
  const generic = /^(operai|tecnic|impiegat|responsabil|ingegner|perit|impiant|personal)/;
  const fallback = input.fallbackKeywords.filter(
    (word) => !generic.test(professionSearchStem(word)) && !domains.some((domain) => mentioned(word, domain.aliases)),
  );
  return {
    functionPattern: professionPattern(functions.length ? functions.flatMap((concept) => concept.aliases) : fallback),
    domainPattern: professionPattern(domains.flatMap((concept) => concept.aliases)),
    otherDomainPattern: domains.length
      ? professionPattern(DOMAINS.filter((concept) => !domains.includes(concept)).flatMap((concept) => concept.aliases))
      : null,
    functionLabels: functions.length ? functions.map((concept) => concept.label) : fallback,
    domainLabels: domains.map((concept) => concept.label),
    functions: functions.map((concept) => ({ label: concept.label, pattern: professionPattern(concept.aliases)! })),
    domains: domains.map((concept) => ({ label: concept.label, pattern: professionPattern(concept.aliases)! })),
  };
}
