/** Password di default degli utenti seed: SOLO sviluppo locale, documentata nel README. */
export const DEFAULT_DEV_PASSWORD = "AdvHr-Dev-2026!";

/**
 * Impedisce operazioni di seed/reset fuori da un database di sviluppo locale.
 * Restituisce l'URL validato.
 */
export function assertSafeDevelopmentDatabase(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL non impostata (vedi .env.example)");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Operazione non consentita con NODE_ENV=production");
  }
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Operazione consentita solo su database locali (host rilevato: ${host})`);
  }
  return url;
}
