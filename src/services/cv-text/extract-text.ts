import path from "node:path";
import { pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

import { MAX_DOCUMENT_SIZE_BYTES } from "@/domain/document";

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
export const MAX_DOCX_XML_BYTES = 4 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 2048;
/** Sotto questa soglia di parole il documento è considerato una scansione. */
const MIN_WORDS = 20;

function normalize(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/gu, " ")
    .replace(/ *\n */g, "\n")
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
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    maxImageSize: 0,
    verbosity: 0,
    cMapUrl: pathToFileURL(`${base}/cmaps/`).href,
    cMapPacked: true,
    standardFontDataUrl: pathToFileURL(`${base}/standard_fonts/`).href,
  });
  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    let length = 0;
    for (let index = 1; index <= Math.min(document.numPages, 15); index++) {
      const content = await (await document.getPage(index)).getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join("");
      pages.push(text.slice(0, MAX_TEXT_LENGTH - length));
      length += pages[pages.length - 1]!.length;
      if (length >= MAX_TEXT_LENGTH) break;
    }
    return pages.join("\n");
  } finally {
    await loadingTask.destroy();
  }
}

/** Legge un file da un archivio ZIP (formato DOCX) senza dipendenze esterne. */
function readZipEntry(bytes: Uint8Array, name: string): Uint8Array | null {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 22) throw new Error("ZIP troncato");
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < Math.max(0, buffer.length - 65_557) || eocd + 22 > buffer.length) throw new Error("ZIP non valido");
  if (eocd + 22 + buffer.readUInt16LE(eocd + 20) !== buffer.length) throw new Error("Commento ZIP non valido");
  const entries = buffer.readUInt16LE(eocd + 10);
  if (
    buffer.readUInt16LE(eocd + 4) !== 0 ||
    buffer.readUInt16LE(eocd + 6) !== 0 ||
    buffer.readUInt16LE(eocd + 8) !== entries ||
    entries > MAX_DOCX_ENTRIES
  )
    throw new Error("ZIP non supportato");
  let offset = buffer.readUInt32LE(eocd + 16);
  const directoryStart = offset;
  const directoryEnd = offset + buffer.readUInt32LE(eocd + 12);
  if (directoryEnd > eocd) throw new Error("Directory ZIP non valida");
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > directoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Voce ZIP non valida");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > directoryEnd) throw new Error("Nome ZIP non valido");
    const entryName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (entryName === name) {
      if (
        flags & 1 ||
        uncompressedSize > MAX_DOCX_XML_BYTES ||
        localOffset + 30 > directoryStart ||
        buffer.readUInt32LE(localOffset) !== 0x04034b50 ||
        buffer.readUInt16LE(localOffset + 8) !== method ||
        buffer.readUInt16LE(localOffset + 6) & 1
      )
        throw new Error("Documento ZIP non supportato");
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      if (
        start + compressedSize > directoryStart ||
        buffer.toString("utf8", localOffset + 30, localOffset + 30 + localNameLength) !== name
      ) {
        throw new Error("Contenuto ZIP non valido");
      }
      const data = buffer.subarray(start, start + compressedSize);
      const output =
        method === 0 ? data : method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_DOCX_XML_BYTES }) : null;
      if (!output || output.length > MAX_DOCX_XML_BYTES || output.length !== uncompressedSize) {
        throw new Error("Dimensione XML non valida");
      }
      return output;
    }
    offset = entryEnd;
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
    .replace(/<[^<>]*>/g, "")
    .replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, entity: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity]!,
    );
}

export async function extractCvText(bytes: Uint8Array, mimeType: string): Promise<ExtractedText> {
  try {
    if (!bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_SIZE_BYTES) return { status: "FAILED", text: "" };
    if (mimeType === "application/pdf") return result(await pdfText(bytes));
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return result(docxText(bytes));
    }
    return { status: "UNSUPPORTED", text: "" };
  } catch {
    return { status: "FAILED", text: "" };
  }
}
