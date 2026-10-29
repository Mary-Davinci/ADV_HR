import { describe, expect, it } from "vitest";

import { isValidVatNumber, type JobRequestFormValues } from "@/domain";
import { validJobRequestValues } from "@/test/job-request-fixtures";

import { jobRequestFormSchema, jobRequestValuesSchema } from "./schemas";

function issuesFor(change: (values: JobRequestFormValues) => void): string[] {
  const values = validJobRequestValues();
  change(values);
  const result = jobRequestFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("isValidVatNumber", () => {
  it("verifica la cifra di controllo", () => {
    expect(isValidVatNumber("11173780963")).toBe(true); // Accademia Da Vinci
    expect(isValidVatNumber("01234567897")).toBe(true);
    expect(isValidVatNumber("01234567890")).toBe(false);
    expect(isValidVatNumber("00000000000")).toBe(false);
    expect(isValidVatNumber("1234567897")).toBe(false);
  });
});

describe("jobRequestFormSchema", () => {
  it("normalizza un modulo completo", () => {
    const form = jobRequestFormSchema.parse(validJobRequestValues());
    expect(form.company).toMatchObject({
      vatOrFiscalCode: "01234567897",
      adminEmail: "amministrazione@collaudo.example",
      sdiCode: "M5UXCR1",
    });
    expect(form.profile).toMatchObject({ positions: 2, province: "BG", travel: false, certifications: null });
    expect(form.contract).toMatchObject({
      fixedTermMonths: 12,
      otherType: null,
      fullTime: true,
      weeklyHours: 40,
      holidayWork: false,
      days: ["MON", "TUE", "WED", "THU", "FRI"],
    });
  });

  it("accetta il codice fiscale di una ditta individuale", () => {
    expect(issuesFor((v) => (v.company.vatOrFiscalCode = "RSSMRA80A01F205X"))).toEqual([]);
  });

  it.each([
    [
      "partita IVA errata",
      (v: JobRequestFormValues) => (v.company.vatOrFiscalCode = "01234567890"),
      "company.vatOrFiscalCode",
    ],
    ["SDI di 6 caratteri", (v: JobRequestFormValues) => (v.company.sdiCode = "ABC123"), "company.sdiCode"],
    ["PEC non valida", (v: JobRequestFormValues) => (v.company.pec = "pec@"), "company.pec"],
    ["referente mancante", (v: JobRequestFormValues) => (v.company.contactName = " "), "company.contactName"],
    ["zero lavoratori", (v: JobRequestFormValues) => (v.profile.positions = "0"), "profile.positions"],
    ["esperienza non indicata", (v: JobRequestFormValues) => (v.profile.experience = ""), "profile.experience"],
    [
      "data inesistente",
      (v: JobRequestFormValues) => (v.profile.expectedHireDate = "2026-02-30"),
      "profile.expectedHireDate",
    ],
    ["mesi mancanti", (v: JobRequestFormValues) => (v.contract.fixedTermMonths = ""), "contract.fixedTermMonths"],
    ["orario invertito", (v: JobRequestFormValues) => (v.contract.to = "07:00"), "contract.to"],
    ["nessun giorno", (v: JobRequestFormValues) => (v.contract.days = []), "contract.days"],
    [
      "smart working senza giorni",
      (v: JobRequestFormValues) => Object.assign(v.contract, { smartWorking: true, smartWorkingDays: "" }),
      "contract.smartWorkingDays",
    ],
    [
      "né azienda né smart working",
      (v: JobRequestFormValues) => Object.assign(v.contract, { onSite: false, smartWorking: false }),
      "contract.onSite",
    ],
    ["altra agevolazione vuota", (v: JobRequestFormValues) => (v.incentives.types = ["OTHER"]), "incentives.other"],
    ["consenso negato", (v: JobRequestFormValues) => (v.consent.granted = false), "consent.granted"],
  ])("rifiuta: %s", (_label, change, path) => {
    expect(issuesFor(change).some((issue) => issue.startsWith(`${path}:`))).toBe(true);
  });

  it("le bozze accettano campi vuoti ma non testi oltre il limite", () => {
    const draft = validJobRequestValues();
    draft.company.pec = "";
    draft.profile.experience = "";
    expect(jobRequestValuesSchema.safeParse(draft).success).toBe(true);
    draft.profile.role = "x".repeat(200);
    expect(jobRequestValuesSchema.safeParse(draft).success).toBe(false);
  });
});
