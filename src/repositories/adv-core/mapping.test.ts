import { describe, expect, it } from "vitest";

import type { AdvCoreCandidate } from "./client";
import {
  mapActivePolicyProgram,
  mapCandidate,
  mapDigitalSkill,
  mapDrivingLicenses,
  mapEducationLevel,
  mapEmploymentStatus,
  mapGender,
  mapLanguages,
  mapWorkMode,
  mapWorkTime,
  mergeFields,
  normalizeDate,
  normalizeEmail,
  normalizeFiscalCode,
  normalizeVatNumber,
  titleCase,
} from "./mapping";

const TODAY = new Date(Date.UTC(2026, 9, 9));

describe("normalizzazione ADV Core", () => {
  it("codice fiscale: maiuscolo, 16 caratteri, altrimenti null", () => {
    expect(normalizeFiscalCode(" rssmra80a01f205x ")).toBe("RSSMRA80A01F205X");
    expect(normalizeFiscalCode("RSSMRA80A01")).toBeNull();
    expect(normalizeFiscalCode(null)).toBeNull();
  });

  it("partita IVA: 11 cifre, prefisso IT tollerato", () => {
    expect(normalizeVatNumber("IT 01234567890")).toBe("01234567890");
    expect(normalizeVatNumber("0123")).toBeNull();
  });

  it("email valide in minuscolo", () => {
    expect(normalizeEmail(" Mario.Rossi@Example.COM ")).toBe("mario.rossi@example.com");
    expect(normalizeEmail("non-una-email")).toBeNull();
  });

  it("date: rifiuta future, inesistenti e prima del 1900", () => {
    expect(normalizeDate("1984-02-29", TODAY)).toBe("1984-02-29");
    expect(normalizeDate("1983-02-29", TODAY)).toBeNull();
    expect(normalizeDate("2030-01-01", TODAY)).toBeNull();
    expect(normalizeDate("1850-01-01", TODAY)).toBeNull();
    expect(normalizeDate("0000-00-00", TODAY)).toBeNull();
  });

  it("CAP: 5 cifre, valori di riempimento scartati", () => {
    const cap = (value: string | null) =>
      mapCandidate({ cap: value } as AdvCoreCandidate, TODAY).fields["profile.residencePostalCode"];
    expect(cap(" 20121 ")).toBe("20121");
    expect(cap("00000")).toBeNull();
    expect(cap("2012")).toBeNull();
    expect(cap(null)).toBeNull();
  });

  it("patente: solo categorie riconosciute", () => {
    expect(mapDrivingLicenses("B")).toEqual(["B"]);
    expect(mapDrivingLicenses("B, CE e D1")).toEqual(["B", "CE", "D1"]);
    expect(mapDrivingLicenses("Nessuna")).toEqual([]);
    expect(mapDrivingLicenses(null)).toEqual([]);
  });

  it("lingue: riconosce il livello e non inventa quello mancante", () => {
    expect(mapLanguages("ITALIANO MADRELINGUA\r\nINGLESE B1")).toEqual([
      { language: "Italiano", level: "NATIVE", notes: "ADV Core: ITALIANO MADRELINGUA" },
      { language: "Inglese", level: "B1", notes: "ADV Core: INGLESE B1" },
    ]);
    expect(mapLanguages("ITALIANO: LINGUA MADRE")[0]?.level).toBe("NATIVE");
    expect(mapLanguages("INGLESE BASE")[0]?.level).toBe("A2");
    expect(mapLanguages("ROMENO C1, RUMENO C2")).toEqual([
      { language: "Rumeno", level: "C1", notes: "ADV Core: ROMENO C1" },
    ]);
    expect(mapLanguages("INGLESE")).toEqual([]);
    expect(mapLanguages("NESSUNA.")).toEqual([]);
  });

  it("informatica: conserva il testo e ignora le risposte vuote", () => {
    expect(mapDigitalSkill("EMAIL, INTERNET, OFFICE LIVELLO INTERMEDIO.")).toEqual({
      level: 3,
      notes: "ADV Core: EMAIL, INTERNET, OFFICE LIVELLO INTERMEDIO.",
    });
    expect(mapDigitalSkill("NESSUNA COMPETENZA")).toBeNull();
    expect(mapDigitalSkill("NO")).toBeNull();
  });

  it("esperienza: anni e mesi insieme, valori fuori scala scartati", () => {
    const fields = (row: Partial<AdvCoreCandidate>) => mapCandidate(row as AdvCoreCandidate, TODAY).fields;
    expect(fields({ esperienza_anni: 2, esperienza_mesi: 6, settore_esperienza: "MAGAZZINIERE" })).toMatchObject({
      "profile.experienceMonths": 30,
      "profile.experienceSector": "MAGAZZINIERE",
    });
    expect(fields({ esperienza_anni: 150, settore_esperienza: "NO" })).toMatchObject({
      "profile.experienceMonths": null,
      "profile.experienceSector": null,
    });
  });

  it("regioni in formato leggibile", () => {
    expect(titleCase("BASILICATA")).toBe("Basilicata");
    expect(titleCase("EMILIA-ROMAGNA")).toBe("Emilia-Romagna");
    expect(titleCase("VALLE D'AOSTA")).toBe("Valle d'Aosta");
  });

  it("sesso, stato occupazionale, orario, modalità", () => {
    expect(mapGender("Uomo")).toBe("MALE");
    expect(mapGender("Donna")).toBe("FEMALE");
    expect(mapGender(null)).toBe("NOT_SPECIFIED");
    expect(mapEmploymentStatus("Disoccupato")).toBe("UNEMPLOYED");
    expect(mapEmploymentStatus("Disoccupati privi di impiego")).toBe("UNEMPLOYED");
    expect(mapEmploymentStatus("Naspi")).toBe("UNEMPLOYED");
    expect(mapEmploymentStatus("NEET")).toBe("INACTIVE");
    expect(mapEmploymentStatus("Occupati Sospesi")).toBe("EMPLOYED");
    expect(mapEmploymentStatus("altro")).toBe("UNKNOWN");
    expect(mapWorkTime("Full time")).toBe("FULL_TIME");
    expect(mapWorkTime("Full time / Part time")).toBe("EITHER");
    expect(mapWorkMode("In presenza")).toBe("ONSITE");
    expect(mapWorkMode("Ibrido")).toBe("HYBRID");
  });

  it("titolo di studio", () => {
    expect(mapEducationLevel("Diploma scuola superiore")).toBe("UPPER_SECONDARY");
    expect(mapEducationLevel("LICENZA MEDIA")).toBe("LOWER_SECONDARY");
    expect(mapEducationLevel("Laurea triennale")).toBe("BACHELOR");
    expect(mapEducationLevel("Laurea magistrale")).toBe("MASTER");
    expect(mapEducationLevel("Diploma universitario (vecchio ordinamento)")).toBe("MASTER");
    expect(mapEducationLevel("Nessun titolo")).toBeNull();
    expect(mapEducationLevel("Licenza elementare")).toBe("OTHER");
  });
});

describe("politiche attive", () => {
  it("riconosce il programma dall'etichetta ADV Core", () => {
    expect(mapActivePolicyProgram("GOL - LOMBARDIA")).toBe("GOL");
    expect(mapActivePolicyProgram("GOL - CALABRIA")).toBe("GOL");
    expect(mapActivePolicyProgram("DIL")).toBe("DIL");
    expect(mapActivePolicyProgram("Tirocinio")).toBe("TIROCINIO");
    expect(mapActivePolicyProgram("Garanzia Giovani")).toBe("GARANZIA_GIOVANI");
    expect(mapActivePolicyProgram("Altro percorso di politica attiva")).toBe("OTHER");
    expect(mapActivePolicyProgram(null)).toBeNull();
    expect(mapActivePolicyProgram("Nessuna")).toBeNull();
  });
});

describe("merge a tre vie (regola: vince ADV_HR, i conflitti sono segnalati)", () => {
  it("campo mai toccato in ADV_HR segue ADV Core", () => {
    const r = mergeFields({ "c.phone": "1" }, { "c.phone": "1" }, { "c.phone": "2" });
    expect(r.updates).toEqual({ "c.phone": "2" });
    expect(r.conflicts).toEqual({});
  });

  it("campo modificato in ADV_HR e invariato in ADV Core: resta, nessun conflitto", () => {
    const r = mergeFields({ "c.phone": "HR" }, { "c.phone": "1" }, { "c.phone": "1" });
    expect(r.updates).toEqual({});
    expect(r.conflicts).toEqual({});
  });

  it("modificato da entrambe le parti: vince ADV_HR e si apre un conflitto", () => {
    const r = mergeFields({ "c.phone": "HR" }, { "c.phone": "1" }, { "c.phone": "2" });
    expect(r.updates).toEqual({});
    expect(r.conflicts).toEqual({ "c.phone": { hr: "HR", advCore: "2" } });
    expect(r.base["c.phone"]).toBe("2");

    // Esecuzione successiva senza altre modifiche: il conflitto resta aperto.
    const again = mergeFields({ "c.phone": "HR" }, r.base, { "c.phone": "2" }, r.conflicts);
    expect(again.conflicts).toEqual({ "c.phone": { hr: "HR", advCore: "2" } });
    expect(again.updates).toEqual({});
  });

  it("il conflitto si chiude quando ADV_HR adotta il valore ADV Core", () => {
    const r = mergeFields(
      { "c.phone": "2" },
      { "c.phone": "2" },
      { "c.phone": "2" },
      { "c.phone": { hr: "HR", advCore: "2" } },
    );
    expect(r.conflicts).toEqual({});
  });

  it("record ADV_HR collegato senza storia: riempie i vuoti, segnala le differenze", () => {
    const r = mergeFields({ "c.phone": null, "c.email": "hr@x.it" }, null, { "c.phone": "3", "c.email": "core@x.it" });
    expect(r.updates).toEqual({ "c.phone": "3" });
    expect(r.conflicts).toEqual({ "c.email": { hr: "hr@x.it", advCore: "core@x.it" } });
  });
});
