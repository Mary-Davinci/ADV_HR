import path from "node:path";
import { pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

/**
 * Estrazione del testo dei CV, interamente in locale (nessun servizio esterno).
 *  - PDF con testo: pdf.js;
 *  - DOCX: lettura diretta di word/document.xml;
 *  - scansioni (PDF immagine, JPG, PNG) e .doc: nessun testo, servirebbe l'OCR.
 */

export type ExtractionStatus = "OK" | "EMPTY" | "UNSUPPORTED" | "FAILED";

export interface ExtractedText {
  status: ExtractionStatus;
  text: string;
}

/** Testo massimo conservato per CV: oltre non serve alla ricerca. */
export const MAX_TEXT_LENGTH = 60_000;
/** Sotto questa soglia di parole il documento è considerato una scansione. */
const MIN_WORDS = 20;

function normalize(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function result(text: string): ExtractedText {
  const clean = normalize(text);
  const words = clean.split(/\s+/).filter((word) => /\p{L}{2,}/u.test(word)).length;
  return words >= MIN_WORDS ? { status: "OK", text: clean } : { status: "EMPTY", text: "" };
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const base = path.join(process.cwd(), "node_modules", "pdfjs-dist");
  const document = await getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    verbosity: 0,
    cMapUrl: pathToFileURL(`${base}/cmaps/`).href,
    cMapPacked: true,
    standardFontDataUrl: pathToFileURL(`${base}/standard_fonts/`).href,
  }).promise;
  try {
    const pages: string[] = [];
    for (let index = 1; index <= Math.min(document.numPages, 15); index++) {
      const content = await (await document.getPage(index)).getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join(""));
    }
    return pages.join("\n");
  } finally {
    await document.destroy();
  }
}

/** Legge un file da un archivio ZIP (formato DOCX) senza dipendenze esterne. */
function readZipEntry(bytes: Uint8Array, name: string): Uint8Array | null {
  const buffer = Buffer.from(bytes);
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries && offset + 46 <= buffer.length; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (entryName === name) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function docxText(bytes: Uint8Array): string {
  const xml = readZipEntry(bytes, "word/document.xml");
  if (!xml) throw new Error("DOCX senza document.xml");
  return Buffer.from(xml)
    .toString("utf8")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, entity: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity]!,
    );
}

export async function extractCvText(bytes: Uint8Array, mimeType: string): Promise<ExtractedText> {
  try {
    if (mimeType === "application/pdf") return result(await pdfText(bytes));
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return result(docxText(bytes));
    }
    return { status: "UNSUPPORTED", text: "" };
  } catch {
    return { status: "FAILED", text: "" };
  }
}
