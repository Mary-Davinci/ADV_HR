import { readFileSync } from "node:fs";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { DomainRuleError } from "@/domain";
import { jobRequestFormSchema } from "@/features/job-requests/schemas";
import { validJobRequestValues } from "@/test/job-request-fixtures";

import { renderJobRequestPdf } from "./job-request-pdf";

const template = new Uint8Array(readFileSync(path.join(process.cwd(), "assets", "Job Description ADV.pdf")));
const meta = { code: "JR-TEST42", revision: 3, generatedAt: new Date(2026, 9, 12, 10, 0) };

describe("renderJobRequestPdf", () => {
  it("compila il modulo ufficiale e lo appiattisce", async () => {
    const form = jobRequestFormSchema.parse(validJobRequestValues());
    const pdf = await renderJobRequestPdf(template, form, meta);
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(3);
    expect(document.getForm().getFields()).toHaveLength(0);
    expect(document.getTitle()).toBe("Job Description JR-TEST42 rev. 3");
  });

  it("rifiuta un testo che non entra nel riquadro invece di troncarlo", async () => {
    const form = jobRequestFormSchema.parse(validJobRequestValues());
    form.profile.drivingLicense = "B, C, CE, D, DE, CQC merci e persone";
    await expect(renderJobRequestPdf(template, form, meta)).rejects.toThrow(/Patente.*troppo lungo/);
  });

  it("rifiuta note troppo lunghe per le righe disponibili", async () => {
    const form = jobRequestFormSchema.parse(validJobRequestValues());
    form.companyNotes = "parola ".repeat(400);
    await expect(renderJobRequestPdf(template, form, meta)).rejects.toBeInstanceOf(DomainRuleError);
  });

  it("segnala caratteri non stampabili con il font del modulo", async () => {
    const form = jobRequestFormSchema.parse(validJobRequestValues());
    form.profile.role = "Operatore 🚜";
    await expect(renderJobRequestPdf(template, form, meta)).rejects.toThrow(/caratteri non supportati/);
  });
});
