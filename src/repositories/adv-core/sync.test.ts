import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  activePolicyParticipations,
  advCoreRecords,
  candidates,
  candidateTags,
  companies,
  documents,
  tags,
} from "@/db/schema";
import { MemoryStorage } from "@/services/storage/document-storage";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

import { AdvCoreApiError, type AdvCoreCandidate, type AdvCoreClient, type AdvCoreCompany } from "./client";
import { runAdvCoreSync, SYNC_TAGS } from "./sync";

const NOW = new Date(Date.UTC(2026, 9, 9, 11, 20));
const PDF = new TextEncoder().encode("%PDF-1.4 curriculum di prova");

function candidate(id: number, overrides: Partial<AdvCoreCandidate> = {}): AdvCoreCandidate {
  return {
    id,
    cognome: `Cognome${id}`,
    nome: `Nome${id}`,
    codice_fiscale: null,
    sesso: null,
    nato_a: null,
    nato_il: "1990-05-10",
    nazionalita: null,
    email: `c${id}@example.com`,
    cellulare: `33300000${id}`,
    telefono: null,
    telefono_2: null,
    altri_contatti: null,
    indirizzo: "Via Prova 1",
    cap: "20100",
    comune: "Milano",
    provincia: "Milano",
    provincia_sigla: "MI",
    regione: "LOMBARDIA",
    domicilio: null,
    titolo_studio: "Diploma scuola superiore",
    data_conseguimento: null,
    luogo_conseguimento: null,
    stato_occupazionale: "Disoccupato",
    profilo_professionale: null,
    settore_esperienza: null,
    esperienza_anni: null,
    esperienza_mesi: null,
    settore_interesse: null,
    politiche_attive_tipologia: null,
    politiche_attive_anno: null,
    tipologia_contrattuale: "Full time",
    modalita_lavoro: "In presenza",
    patente: null,
    certificazioni: null,
    competenze_linguistiche: null,
    competenze_informatiche: null,
    disponibilita_trasferimento: "NO",
    disponibilita_trasferte: "SI",
    ultimo_contatto_adv: null,
    ultima_revisione_scheda: null,
    note_colloquio: null,
    attivo: 0,
    data_inserimento: "2026-01-01 10:00:00",
    data_ultima_modifica: null,
    data_cancellazione: null,
    cv: [],
    ...overrides,
  };
}

function company(id: number, overrides: Partial<AdvCoreCompany> = {}): AdvCoreCompany {
  return {
    id,
    denominazione: `Azienda ${id} SRL`,
    tipo_azienda: "Azienda / Ditta",
    codice_ateco: "Lavori di meccanica generale (25.62)",
    indirizzo: null,
    cap: null,
    comune: "Cosenza",
    provincia: "Cosenza",
    provincia_sigla: "CS",
    regione: "CALABRIA",
    telefono: null,
    cellulare: null,
    email: `azienda${id}@example.com`,
    pec: null,
    web: null,
    partita_iva: `0123456789${id}`,
    codice_fiscale: null,
    cognome_rappresentante: null,
    nome_rappresentante: null,
    numero_dipendenti: null,
    fondo_interprofessionale: null,
    informazioni: null,
    annotazioni: null,
    attivo: 0,
    abilitato: 0,
    data_inserimento: null,
    data_ultima_modifica: null,
    data_cancellazione: null,
    sedi: [],
    ...overrides,
  };
}

/** API ADV CORE finta, modificabile tra un'esecuzione e l'altra. */
function fakeApi() {
  const state = {
    candidates: [] as AdvCoreCandidate[],
    companies: [] as AdvCoreCompany[],
    /** Totali dichiarati da stato.php (per simulare elenchi incompleti). */
    declaredCandidates: null as number | null,
    failWith: null as Error | null,
    downloads: 0,
  };
  const client: AdvCoreClient = {
    async status() {
      if (state.failWith) throw state.failWith;
      return {
        api_version: "v1",
        candidati: state.declaredCandidates ?? state.candidates.length,
        cv: 0,
        aziende: state.companies.length,
        sedi: 0,
        dati_protetti_esposti: false,
      };
    },
    listCandidates: async () => structuredClone(state.candidates),
    listCompanies: async () => structuredClone(state.companies),
    async downloadCv(id) {
      state.downloads++;
      if (id === 902) return { bytes: new TextEncoder().encode("firmato p7m"), mimeType: "application/pkcs7-mime" };
      return { bytes: PDF, mimeType: "application/pdf" };
    },
  };
  return { state, client };
}

const cvMeta = (id: number, tipo = "application/pdf") => ({
  id,
  nome_documento: "Curriculum",
  tipo_file: tipo,
  disponibile: true,
  dimensione_bytes: 100,
  file_modificato_il: "2026-01-01T10:00:00+01:00",
  data_inserimento: "2026-01-01 10:00:00",
});

describe("sincronizzazione ADV Core", () => {
  let testDb: TestDatabase;
  const storage = new MemoryStorage();
  const api = fakeApi();
  const sync = () => runAdvCoreSync({ db: testDb.db, client: api.client, storage, trigger: "MANUAL", now: () => NOW });

  async function candidateByLegacy(legacyId: number) {
    const rows = await testDb.db.execute(sql`
      SELECT c.* FROM candidates c
      JOIN legacy_mappings m ON m.adv_hr_id = c.id AND m.entity_type = 'CANDIDATE' AND m.legacy_id = ${String(legacyId)}`);
    return (rows as unknown as { rows: Array<Record<string, unknown>> }).rows[0];
  }

  async function tagsOf(candidateId: string): Promise<string[]> {
    const rows = await testDb.db
      .select({ slug: tags.slug })
      .from(candidateTags)
      .innerJoin(tags, eq(tags.id, candidateTags.tagId))
      .where(eq(candidateTags.candidateId, candidateId));
    return rows.map((row) => row.slug).sort();
  }

  async function record(entityType: "CANDIDATE" | "COMPANY" | "DOCUMENT", legacyId: number) {
    const [row] = await testDb.db
      .select()
      .from(advCoreRecords)
      .where(and(eq(advCoreRecords.entityType, entityType), eq(advCoreRecords.legacyId, String(legacyId))));
    return row;
  }

  beforeAll(async () => {
    testDb = await createTestDatabase();
    // Candidato già presente in ADV_HR prima del bridge: va collegato, non duplicato.
    await testDb.db.insert(candidates).values({
      firstName: "Giulia",
      lastName: "Preesistente",
      fiscalCode: "PRSGLI85A41F205Z",
      email: "giulia.hr@example.com",
      phone: null,
    });
  }, 60_000);

  afterAll(() => testDb?.close());

  it("prima esecuzione: importa aziende, candidati e CV", async () => {
    api.state.companies = [company(1), company(2)];
    api.state.candidates = [
      candidate(101, {
        codice_fiscale: "RSSMRA80A01F205X",
        sesso: "Uomo",
        cv: [cvMeta(901), cvMeta(902, "application/pkcs7-mime")],
      }),
      candidate(102, { codice_fiscale: "RSSMRA80A01F205X" }), // CF duplicato in ADV Core
      candidate(103, { data_cancellazione: "2026-05-01 09:00:00" }), // cancellato in ADV Core
      candidate(104, { codice_fiscale: "PRSGLI85A41F205Z", email: "giulia.core@example.com", cellulare: "3330000999" }),
    ];

    const summary = await sync();
    expect(summary.status).toBe("SUCCESS");
    expect(summary.stats).toMatchObject({
      companiesCreated: 2,
      candidatesCreated: 3,
      candidatesLinked: 1,
      candidatesDuplicateFiscalCode: 1,
      cvCreated: 1,
      cvSkipped: 1,
    });

    const mario = await candidateByLegacy(101);
    expect(mario).toMatchObject({ first_name: "Nome101", fiscal_code: "RSSMRA80A01F205X", gender: "MALE" });
    expect(await tagsOf(String(mario!.id))).toEqual([SYNC_TAGS.imported.slug]);

    const duplicate = await candidateByLegacy(102);
    expect(duplicate!.fiscal_code).toBeNull();
    expect(await tagsOf(String(duplicate!.id))).toContain(SYNC_TAGS.duplicate.slug);

    const deleted = await candidateByLegacy(103);
    expect(await tagsOf(String(deleted!.id))).toContain(SYNC_TAGS.removed.slug);

    // Collegamento al candidato ADV_HR preesistente: vuoti riempiti, differenze segnalate.
    const giulia = await candidateByLegacy(104);
    expect(giulia).toMatchObject({ last_name: "Preesistente", email: "giulia.hr@example.com", phone: "3330000999" });
    expect(await tagsOf(String(giulia!.id))).toContain(SYNC_TAGS.conflict.slug);
    expect(Object.keys((await record("CANDIDATE", 104))!.conflicts)).toContain("candidate.email");

    const [region] = await testDb.db
      .select({ region: companies.region, source: companies.source })
      .from(companies)
      .limit(1);
    expect(region).toEqual({ region: "Calabria", source: "ADV_CORE" });

    const cvRows = await testDb.db.select().from(documents);
    expect(cvRows).toHaveLength(1);
    expect(cvRows[0]).toMatchObject({ type: "CV", candidateId: mario!.id, mimeType: "application/pdf" });
    expect((await record("DOCUMENT", 902))!.skippedReason).toBeTruthy();
  });

  it("modifiche in ADV_HR: vince ADV_HR, i campi non toccati seguono ADV Core", async () => {
    const mario = await candidateByLegacy(101);
    await testDb.db
      .update(candidates)
      .set({ email: "mario.modificato.hr@example.com" })
      .where(eq(candidates.id, String(mario!.id)));

    api.state.candidates[0] = {
      ...api.state.candidates[0]!,
      email: "mario.nuovo.core@example.com",
      cellulare: "3339999999",
    };
    const downloadsBefore = api.state.downloads;

    const summary = await sync();
    expect(summary.status).toBe("SUCCESS");

    const after = await candidateByLegacy(101);
    expect(after!.email).toBe("mario.modificato.hr@example.com");
    expect(after!.phone).toBe("3339999999");
    expect(await tagsOf(String(after!.id))).toContain(SYNC_TAGS.conflict.slug);
    expect((await record("CANDIDATE", 101))!.conflicts).toEqual({
      "candidate.email": { hr: "mario.modificato.hr@example.com", advCore: "mario.nuovo.core@example.com" },
    });
    // CV invariato: non viene riscaricato.
    expect(api.state.downloads).toBe(downloadsBefore);
    expect(summary.stats.cvUnchanged).toBe(2);
  });

  it("politiche attive: riallineate a ogni modifica, quelle inserite in ADV_HR restano", async () => {
    const policiesOf = async (candidateId: string) =>
      (
        await testDb.db
          .select({
            program: activePolicyParticipations.programType,
            year: activePolicyParticipations.referenceYear,
            notes: activePolicyParticipations.notes,
          })
          .from(activePolicyParticipations)
          .where(eq(activePolicyParticipations.candidateId, candidateId))
      ).sort((a, b) => String(a.notes).localeCompare(String(b.notes)));

    const mario = await candidateByLegacy(101);
    const marioId = String(mario!.id);
    await testDb.db
      .insert(activePolicyParticipations)
      .values({ candidateId: marioId, programType: "GARANZIA_GIOVANI", referenceYear: 2023, notes: "Inserita da HR" });

    const index = api.state.candidates.findIndex((c) => c.id === 101);
    const update = (fields: Partial<AdvCoreCandidate>) =>
      (api.state.candidates[index] = { ...api.state.candidates[index]!, ...fields });

    update({ politiche_attive_tipologia: "GOL - LOMBARDIA", politiche_attive_anno: "2025" });
    await sync();
    expect(await policiesOf(marioId)).toEqual([
      { program: "GOL", year: 2025, notes: "ADV Core: GOL - LOMBARDIA" },
      { program: "GARANZIA_GIOVANI", year: 2023, notes: "Inserita da HR" },
    ]);

    update({ politiche_attive_tipologia: "DIL", politiche_attive_anno: "2026" });
    await sync();
    expect(await policiesOf(marioId)).toEqual([
      { program: "DIL", year: 2026, notes: "ADV Core: DIL" },
      { program: "GARANZIA_GIOVANI", year: 2023, notes: "Inserita da HR" },
    ]);

    update({ politiche_attive_tipologia: null, politiche_attive_anno: null });
    await sync();
    expect(await policiesOf(marioId)).toEqual([{ program: "GARANZIA_GIOVANI", year: 2023, notes: "Inserita da HR" }]);
  });

  it("elenco incompleto: nessun record viene segnalato come rimosso", async () => {
    const removedFromList = api.state.candidates.pop()!;
    api.state.declaredCandidates = api.state.candidates.length + 1;

    const summary = await sync();
    expect(summary.status).toBe("PARTIAL");
    expect((await record("CANDIDATE", removedFromList.id))!.removedAt).toBeNull();

    api.state.candidates.push(removedFromList);
    api.state.declaredCandidates = null;
  });

  it("record sparito da ADV Core: segnalato, mai cancellato da ADV_HR", async () => {
    api.state.candidates = api.state.candidates.filter((c) => c.id !== 102);
    const summary = await sync();
    expect(summary.status).toBe("SUCCESS");
    expect(summary.stats.candidatesMissing).toBe(1);

    const gone = await candidateByLegacy(102);
    expect(gone).toBeDefined();
    expect(await tagsOf(String(gone!.id))).toContain(SYNC_TAGS.removed.slug);
    expect((await record("CANDIDATE", 102))!.removedReason).toBe("NON_PIU_PRESENTE");
  });

  it("esecuzione senza cambiamenti: niente scritture", async () => {
    const summary = await sync();
    expect(summary.status).toBe("SUCCESS");
    expect(summary.stats.candidatesUpdated ?? 0).toBe(0);
    expect(summary.stats.candidatesCreated ?? 0).toBe(0);
    expect(summary.stats.candidatesUnchanged).toBe(api.state.candidates.length);
  });

  it("API non raggiungibile o IP non autorizzato: esecuzione FAILED registrata", async () => {
    api.state.failWith = new AdvCoreApiError("stato.php: Indirizzo IP non autorizzato.", 403, "ip_not_allowed");
    const summary = await sync();
    expect(summary.status).toBe("FAILED");
    expect(summary.errorMessage).toContain("IP non autorizzato");
    api.state.failWith = null;
  });
});
