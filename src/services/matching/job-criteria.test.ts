import { describe, expect, it } from "vitest";

import { jobRequestFormSchema } from "@/features/job-requests/schemas";
import { validJobRequestValues } from "@/test/job-request-fixtures";

import { educationSatisfies, jobKeywords, requiredEducationLevel, searchCriteria } from "./job-criteria";

describe("criteri di ricerca dal modulo", () => {
  it.each([
    ["Diploma tecnico (meccanica)", "UPPER_SECONDARY"],
    ["Laurea in economia", "BACHELOR"],
    ["Laurea magistrale in ingegneria", "MASTER"],
    ["ITS meccatronica", "POST_SECONDARY"],
    ["Qualifica professionale", "VOCATIONAL"],
    ["Licenza media", "LOWER_SECONDARY"],
    ["Nessun titolo particolare", null],
  ])("livello minimo da «%s»", (text, level) => {
    expect(requiredEducationLevel(text)).toBe(level);
  });

  it("non scambia parole che contengono «its» per un ITS", () => {
    expect(requiredEducationLevel("Kits di montaggio")).toBeNull();
  });

  it("confronta i livelli senza bocciare i dati mancanti", () => {
    expect(educationSatisfies("BACHELOR", "UPPER_SECONDARY")).toBe(true);
    expect(educationSatisfies("LOWER_SECONDARY", "UPPER_SECONDARY")).toBe(false);
    expect(educationSatisfies(null, "UPPER_SECONDARY")).toBeNull();
    expect(educationSatisfies("OTHER", "UPPER_SECONDARY")).toBeNull();
    expect(educationSatisfies("MASTER", null)).toBeNull();
  });

  it("estrae parole chiave significative, senza parole generiche né accenti", () => {
    const values = validJobRequestValues();
    values.profile.role = "Operatore CNC";
    values.profile.duties = "Attrezzaggio e conduzione di centri di lavoro, esperienza su tornio";
    values.profile.activities = "Controllo qualità";
    values.profile.mandatoryRequirements = "Disponibilità su due turni";
    const keywords = jobKeywords(jobRequestFormSchema.parse(values));
    expect(keywords).toEqual(expect.arrayContaining(["operatore", "cnc", "attrezzaggio", "tornio", "qualita"]));
    expect(keywords).not.toEqual(expect.arrayContaining(["esperienza"]));
    expect(keywords).not.toContain("due");
    expect(keywords).not.toContain("disponibilita");
    expect(keywords.length).toBeLessThanOrEqual(15);
  });

  it("riassume i criteri del modulo", () => {
    const criteria = searchCriteria(jobRequestFormSchema.parse(validJobRequestValues()));
    expect(criteria).toMatchObject({ province: "BG", city: "Lallio", minEducationLevel: "UPPER_SECONDARY" });
  });
});
