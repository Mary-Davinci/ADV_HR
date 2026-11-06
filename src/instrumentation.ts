/**
 * Il gestionale lavora in ora italiana. Railway esegue in UTC: senza questa impostazione
 * un orario scritto nel modulo verrebbe letto come UTC sul server e riletto come ora
 * italiana nel browser, spostando i colloqui di 1-2 ore a ogni salvataggio.
 */
export function register() {
  process.env.TZ = "Europe/Rome";
}
