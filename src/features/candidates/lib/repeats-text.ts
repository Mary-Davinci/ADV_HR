const STOPWORDS = new Set([
  "della",
  "delle",
  "dello",
  "degli",
  "nella",
  "nelle",
  "nello",
  "sulla",
  "sulle",
  "come",
  "anche",
  "presso",
  "settore",
]);

/** Radici delle parole significative: "manutenzione" e "manutentore" diventano entrambe "manute". */
function stems(text: string): Set<string> {
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
  return new Set(words.map((word) => word.slice(0, 6)));
}

/**
 * True quando due testi brevi dicono la stessa cosa con parole diverse
 * (es. il ruolo dichiarato e la sintesi professionale): almeno il 60% delle
 * radici del testo più corto compare anche nell'altro.
 */
export function repeatsText(a: string, b: string): boolean {
  const left = stems(a);
  const right = stems(b);
  const smaller = left.size <= right.size ? left : right;
  const larger = smaller === left ? right : left;
  if (smaller.size === 0) return false;
  const shared = [...smaller].filter((stem) => larger.has(stem)).length;
  return shared / smaller.size >= 0.6;
}
