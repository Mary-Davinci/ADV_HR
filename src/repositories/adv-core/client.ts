/**
 * Client HTTP dell'API ADV CORE v1 (sola lettura).
 * Contratto: docs/ADV_CORE_BRIDGE.md → "API ADV CORE".
 */

/** Curriculum come descritto dall'API (il file si scarica a parte). */
export interface AdvCoreCv {
  id: number;
  nome_documento: string | null;
  tipo_file: string | null;
  disponibile: boolean;
  dimensione_bytes: number | null;
  file_modificato_il: string | null;
  data_inserimento: string | null;
}

/** Candidato ADV CORE. I campi testuali vuoti arrivano già come null. */
export interface AdvCoreCandidate {
  id: number;
  cognome: string | null;
  nome: string | null;
  codice_fiscale: string | null;
  sesso: string | null;
  nato_a: string | null;
  nato_il: string | null;
  nazionalita: string | null;
  email: string | null;
  cellulare: string | null;
  telefono: string | null;
  telefono_2: string | null;
  altri_contatti: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  provincia_sigla: string | null;
  regione: string | null;
  domicilio: string | null;
  titolo_studio: string | null;
  data_conseguimento: string | null;
  luogo_conseguimento: string | null;
  stato_occupazionale: string | null;
  profilo_professionale: string | null;
  settore_esperienza: string | null;
  esperienza_anni: number | null;
  esperienza_mesi: number | null;
  settore_interesse: string | null;
  politiche_attive_tipologia: string | null;
  politiche_attive_anno: string | number | null;
  tipologia_contrattuale: string | null;
  modalita_lavoro: string | null;
  patente: string | null;
  certificazioni: string | null;
  competenze_linguistiche: string | null;
  competenze_informatiche: string | null;
  disponibilita_trasferimento: string | null;
  disponibilita_trasferte: string | null;
  ultimo_contatto_adv: string | null;
  ultima_revisione_scheda: string | null;
  note_colloquio: string | null;
  attivo: number | null;
  data_inserimento: string | null;
  data_ultima_modifica: string | null;
  data_cancellazione: string | null;
  cv: AdvCoreCv[];
  /** Presente solo se ADV CORE ha abilitato l'esposizione dei dati particolari. */
  dati_protetti?: { collocamento_mirato: string | null; soggetto_svantaggiato: string | null };
}

export interface AdvCoreSite {
  id: number;
  id_azienda: number;
  indirizzo: string | null;
  comune: string | null;
  telefono: string | null;
  cellulare: string | null;
  email: string | null;
  referente: string | null;
  informazioni: string | null;
}

export interface AdvCoreCompany {
  id: number;
  denominazione: string | null;
  tipo_azienda: string | null;
  codice_ateco: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  provincia_sigla: string | null;
  regione: string | null;
  telefono: string | null;
  cellulare: string | null;
  email: string | null;
  pec: string | null;
  web: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  cognome_rappresentante: string | null;
  nome_rappresentante: string | null;
  numero_dipendenti: string | null;
  fondo_interprofessionale: string | null;
  informazioni: string | null;
  annotazioni: string | null;
  attivo: number | null;
  abilitato: number | null;
  data_inserimento: string | null;
  data_ultima_modifica: string | null;
  data_cancellazione: string | null;
  sedi: AdvCoreSite[];
}

export interface AdvCoreStatus {
  api_version: string;
  candidati: number;
  cv: number;
  aziende: number;
  sedi: number;
  dati_protetti_esposti: boolean;
}

export interface AdvCoreFile {
  bytes: Uint8Array;
  mimeType: string;
}

export interface AdvCoreClient {
  status(): Promise<AdvCoreStatus>;
  listCandidates(): Promise<AdvCoreCandidate[]>;
  listCompanies(): Promise<AdvCoreCompany[]>;
  downloadCv(id: number): Promise<AdvCoreFile>;
}

/** Errore restituito dall'API: `code` è il codice applicativo (es. ip_not_allowed). */
export class AdvCoreApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "AdvCoreApiError";
  }
}

export interface AdvCoreClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  pageSize?: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Page<T> {
  data: T[];
  pagination: { after_id: number; next_after_id: number; limit: number; has_more: boolean };
}

export function createAdvCoreClient(options: AdvCoreClientOptions): AdvCoreClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const retries = options.retries ?? 3;
  const pageSize = options.pageSize ?? 500;

  async function request(path: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await delay(1_000 * 2 ** (attempt - 1));
      try {
        const response = await doFetch(`${baseUrl}/api/v1/${path}`, {
          headers: { Authorization: `Bearer ${options.apiKey}`, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok) return response;

        let code = "http_error";
        let message = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { error?: { code?: string; message?: string } };
          code = body.error?.code ?? code;
          message = body.error?.message ?? message;
        } catch {
          // corpo non JSON: si tiene il messaggio generico
        }
        const error = new AdvCoreApiError(`${path}: ${message}`, response.status, code);
        // 4xx = configurazione/chiave/IP: ripetere non serve.
        if (response.status < 500) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof AdvCoreApiError && error.status < 500) throw error;
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`${path}: richiesta fallita`);
  }

  async function getJson<T>(path: string): Promise<T> {
    return (await (await request(path)).json()) as T;
  }

  async function listAll<T extends { id: number }>(endpoint: string): Promise<T[]> {
    const items: T[] = [];
    let afterId = 0;
    for (;;) {
      const page = await getJson<Page<T>>(`${endpoint}?after_id=${afterId}&limit=${pageSize}`);
      if (!Array.isArray(page.data) || !page.pagination) throw new Error(`${endpoint}: risposta non valida`);
      items.push(...page.data);
      if (!page.pagination.has_more) return items;
      // Protezione da cicli infiniti se il cursore non avanza.
      if (page.pagination.next_after_id <= afterId) throw new Error(`${endpoint}: paginazione non valida`);
      afterId = page.pagination.next_after_id;
    }
  }

  return {
    async status() {
      return (await getJson<{ data: AdvCoreStatus }>("stato.php")).data;
    },
    listCandidates: () => listAll<AdvCoreCandidate>("candidati.php"),
    listCompanies: () => listAll<AdvCoreCompany>("aziende.php"),
    async downloadCv(id: number) {
      const response = await request(`cv.php?id=${id}`);
      const mimeType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim();
      return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType };
    },
  };
}
