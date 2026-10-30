import { deflateRawSync } from "node:zlib";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_SIZE_BYTES } from "@/domain/document";

import { extractCvText, MAX_DOCX_XML_BYTES } from "./extract-text";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const WORDS =
  "Esperienza professionale gestione clienti sviluppo software analisi dati coordinamento progetti formazione personale comunicazione aziendale ricerca selezione candidati competenze organizzative avanzate";

/** Minimal ZIP with a central directory, including optionally deceptive size metadata. */
function docx(xml: string, options: { declaredSize?: number; stored?: boolean; encrypted?: boolean } = {}): Buffer {
  const name = Buffer.from("word/document.xml");
  const raw = Buffer.from(xml);
  const compressed = options.stored ? raw : deflateRawSync(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(options.stored ? 0 : 8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(options.declaredSize ?? raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(options.encrypted ? 1 : 0, 8);
  central.writeUInt16LE(options.stored ? 0 : 8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(options.declaredSize ?? raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return Buffer.concat([local, name, compressed, central, name, end]);
}

describe("CV extraction security", () => {
  it("handles malformed markup and long Unicode whitespace without quadratic backtracking", async () => {
    expect((await extractCvText(docx("<".repeat(200_000)), DOCX)).status).toBe("EMPTY");
    expect((await extractCvText(docx(`<w:p>${"\u00a0".repeat(200_000)}</w:p>`), DOCX)).status).toBe("EMPTY");
  }, 2_000);

  it.each([false, true])("extracts ordinary DOCX (stored=%s)", async (stored) => {
    const result = await extractCvText(docx(`<w:p>${WORDS}</w:p>`, { stored }), DOCX);
    expect(result.status).toBe("OK");
    expect(result.text).toBe(WORDS);
  });

  it("rejects excessive declared XML size before decompression", async () => {
    const result = await extractCvText(docx(WORDS, { declaredSize: MAX_DOCX_XML_BYTES + 1 }), DOCX);
    expect(result).toEqual({ status: "FAILED", text: "" });
  });

  it("bounds real decompression even if a ZIP bomb lies about its size", async () => {
    const bomb = docx("x".repeat(MAX_DOCX_XML_BYTES + 1), { declaredSize: 1 });
    expect(bomb.length).toBeLessThan(10_000);
    expect(await extractCvText(bomb, DOCX)).toEqual({ status: "FAILED", text: "" });
  });

  it("rejects encrypted entries, truncated directories and invalid offsets", async () => {
    expect((await extractCvText(docx(WORDS, { encrypted: true }), DOCX)).status).toBe("FAILED");
    const truncated = docx(WORDS).subarray(0, -10);
    expect((await extractCvText(truncated, DOCX)).status).toBe("FAILED");
    const invalid = docx(WORDS);
    invalid.writeUInt32LE(0xfffffff0, invalid.length - 6);
    expect((await extractCvText(invalid, DOCX)).status).toBe("FAILED");
  });

  it("rejects oversized input before parsing", async () => {
    expect((await extractCvText(new Uint8Array(MAX_DOCUMENT_SIZE_BYTES + 1), "application/pdf")).status).toBe("FAILED");
  });

  it("extracts text from a real PDF using the upgraded parser", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([1200, 600]).drawText(WORDS, { x: 10, y: 500, size: 8, font });
    const extracted = await extractCvText(await pdf.save(), "application/pdf");
    expect(extracted.status).toBe("OK");
    expect(extracted.text).toContain("Esperienza professionale");
  }, 20_000);
});
