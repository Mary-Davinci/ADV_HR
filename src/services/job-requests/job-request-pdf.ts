import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import {
  DomainRuleError,
  WORK_DAYS,
  type HiringDocument,
  type HiringIncentive,
  type JobRequestForm,
  type WorkDay,
} from "@/domain";

/**
 * Compila il modulo ufficiale "Allegato 1 – Job Description" (PDF con campi)
 * a partire da un JobRequestForm GIÀ validato. Regole:
 *  - nessun testo viene troncato: se non entra nel riquadro anche al corpo
 *    minimo, la generazione fallisce indicando il campo da accorciare;
 *  - il PDF prodotto è "appiattito" (campi non più modificabili), con codice
 *    e revisione della richiesta stampati su ogni pagina;
 *  - il range di età del cartaceo resta volutamente vuoto (D.Lgs. 216/2003);
 *    luogo, data e firma si compilano a mano.
 */

export interface JobRequestPdfMeta {
  code: string;
  revision: number;
  generatedAt: Date;
}

const MAX_FONT_SIZE = 9;
const MIN_FONT_SIZE = 6;
const NOTE_FONT_SIZE = 8;
const FIELD_PADDING = 4;

const DAY_FIELDS: Record<WorkDay, string> = {
  MON: "Lunedì",
  TUE: "Martedì",
  WED: "Mercoledì",
  THU: "Giovedì",
  FRI: "Venerdì",
  SAT: "Sabato",
  SUN: "Domenica",
};

const INCENTIVE_FIELDS: Record<HiringIncentive, string> = {
  APPRENTICESHIP: "Apprendistato",
  PROTECTED_CATEGORIES: "Categorie Protette L 6899",
  LONG_TERM_UNEMPLOYED: "Iscritti di lunga durata L40790",
  MOBILITY_LISTS: "Iscrizione liste di mobilità",
  INSERTION_CONTRACT: "Contratto di inserimento",
  OTHER: "undefined_4",
};

const DOCUMENT_FIELDS: Record<HiringDocument, string> = {
  SAP_RECORD: "Scheda anagraficaC2 storico SAP",
  DID: "DID",
  SERVICE_AGREEMENT: "Patto di servizio",
  IDENTITY_DOCUMENT: "Documento didentità e CF",
  UPDATED_CV: "CV aggiornato",
  TARGETED_PLACEMENT: "Attestazione iscrizione liste di collocamento mirato",
  OTHER: "Altro_3",
};

const CONTRACT_FIELDS = {
  PERMANENT: "Tempo Indeterminato",
  FIXED_TERM: "TIPOLOGIA CONTRATTO", // nel modulo la casella "Tempo Determinato" ha questo nome
  INTERNSHIP: "Tirocinio",
  OTHER: "undefined_2",
} as const;

/**
 * Gli 8 riquadri degli orari condividono lo stesso nome ("Testo1") nel modulo:
 * si scrivono direttamente nelle loro posizioni (ordinate per x).
 * Ordine: tempo pieno [dalle hh, dalle mm, alle hh, alle mm], poi tempo parziale.
 */
const TIME_FIELD = "Testo1";

class PdfFiller {
  constructor(
    private readonly document: PDFDocument,
    private readonly font: PDFFont,
  ) {}

  private get form() {
    return this.document.getForm();
  }

  /** Corpo del testo che lo fa entrare nel riquadro, o errore se troppo lungo. */
  private fitSize(value: string, width: number, label: string): number {
    let unitWidth: number;
    try {
      unitWidth = this.font.widthOfTextAtSize(value, 1);
    } catch {
      throw new DomainRuleError(`"${label}" contiene caratteri non supportati dal modulo PDF.`, "PDF_CHARSET");
    }
    const size = Math.min(MAX_FONT_SIZE, (width - FIELD_PADDING) / Math.max(unitWidth, 0.001));
    if (size < MIN_FONT_SIZE) {
      throw new DomainRuleError(`Il testo di "${label}" è troppo lungo per il modulo: accorcialo.`, "PDF_OVERFLOW");
    }
    return Math.floor(size * 10) / 10;
  }

  text(field: string, value: string | number | null | undefined, label: string) {
    if (value === null || value === undefined || value === "") return;
    const content = String(value).replace(/\s+/g, " ").trim();
    const textField = this.form.getTextField(field);
    const width = textField.acroField.getWidgets()[0]!.getRectangle().width;
    textField.setText(content);
    textField.setFontSize(this.fitSize(content, width, label));
  }

  /** Testo lungo distribuito su più righe (campi NOTE): errore se non basta lo spazio. */
  lines(fields: string[], value: string | null, label: string) {
    if (!value) return;
    const widths = fields.map((field) => this.form.getTextField(field).acroField.getWidgets()[0]!.getRectangle().width);
    const words = value.replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const width = widths[lines.length] ?? 0;
      if (this.measure(candidate, label) <= width - FIELD_PADDING) {
        current = candidate;
      } else {
        if (!current)
          throw new DomainRuleError(`Il testo di "${label}" contiene una parola troppo lunga.`, "PDF_OVERFLOW");
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (lines.length > fields.length) {
      throw new DomainRuleError(`Il testo di "${label}" è troppo lungo per il modulo: accorcialo.`, "PDF_OVERFLOW");
    }
    lines.forEach((line, index) => {
      const textField = this.form.getTextField(fields[index]!);
      textField.setText(line);
      textField.setFontSize(NOTE_FONT_SIZE);
    });
  }

  private measure(value: string, label: string): number {
    try {
      return this.font.widthOfTextAtSize(value, NOTE_FONT_SIZE);
    } catch {
      throw new DomainRuleError(`"${label}" contiene caratteri non supportati dal modulo PDF.`, "PDF_CHARSET");
    }
  }

  check(field: string, checked = true) {
    if (checked) this.form.getCheckBox(field).check();
  }

  /**
   * Ore e minuti nei riquadri condivisi "Testo1". Restituisce il disegno da
   * eseguire DOPO l'appiattimento, così nessun riquadro può coprirlo.
   */
  times(page: PDFPage, fullTime: boolean, from: string, to: string): () => void {
    const widgets = this.form
      .getTextField(TIME_FIELD)
      .acroField.getWidgets()
      .map((widget) => widget.getRectangle())
      .sort((a, b) => a.x - b.x);
    const boxes = fullTime ? widgets.slice(0, 4) : widgets.slice(4, 8);
    const [fromHours, fromMinutes] = from.split(":");
    const [toHours, toMinutes] = to.split(":");
    return () =>
      [fromHours, fromMinutes, toHours, toMinutes].forEach((value, index) => {
        const box = boxes[index]!;
        const width = this.font.widthOfTextAtSize(value!, MAX_FONT_SIZE);
        page.drawText(value!, {
          x: box.x + (box.width - width) / 2,
          y: box.y + (box.height - MAX_FONT_SIZE) / 2 + 1,
          size: MAX_FONT_SIZE,
          font: this.font,
        });
      });
  }
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export async function renderJobRequestPdf(
  template: Uint8Array,
  form: JobRequestForm,
  meta: JobRequestPdfMeta,
): Promise<Uint8Array> {
  const document = await PDFDocument.load(template);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const fill = new PdfFiller(document, font);
  const { company, profile, contract, incentives, documents } = form;

  // Dati azienda
  fill.text("Ragione Sociale", company.name, "Ragione sociale");
  fill.text("Partita IVACF", company.vatOrFiscalCode, "Partita IVA/C.F.");
  fill.text("Sede Legale", company.registeredOffice, "Sede legale");
  fill.text("Sede Operativa", company.operatingOffice, "Sede operativa");
  fill.text("Telefono", company.phone, "Telefono");
  fill.text("E mail amministrazione", company.adminEmail, "Email amministrazione");
  fill.text("PEC", company.pec, "PEC");
  fill.text("Codice SDI", company.sdiCode, "Codice SDI");
  fill.text("Referente Selezione del Personale", company.contactName, "Referente selezione");
  fill.text("E mail", company.contactEmail, "Email del referente");
  fill.text("Telefono_2", company.contactPhone, "Telefono del referente");

  // Profilo ricercato
  fill.text("Ruolo", profile.role, "Ruolo");
  fill.text("Numero lavoratori richiesti", profile.positions, "Numero lavoratori");
  fill.check({ NONE: "NESSUNA", JUNIOR: "JUNIOR", SENIOR: "SENIOR" }[profile.experience]);
  fill.text("Luogo di Lavoro Città", profile.city, "Luogo di lavoro");
  fill.text("Provincia", profile.province, "Provincia");
  fill.check(profile.travel ? "SI" : "NO");
  fill.text("Mansionario Sintetico", profile.duties, "Mansionario sintetico");
  fill.text("Descrizione sintetica attività", profile.activities, "Descrizione attività");
  fill.text("Istruzione", profile.education, "Istruzione");
  fill.text("Patente", profile.drivingLicense, "Patente");
  fill.text("Certificazioni", profile.certifications, "Certificazioni");
  fill.text("Requisiti Indispensabili", profile.mandatoryRequirements, "Requisiti indispensabili");
  fill.text(
    "Data prevista assunzione",
    profile.expectedHireDate && formatDate(profile.expectedHireDate),
    "Data prevista assunzione",
  );

  // Tipologia contratto
  fill.check(CONTRACT_FIELDS[contract.type]);
  fill.text("Tempo Determinato di mesi", contract.fixedTermMonths, "Mesi di tempo determinato");
  fill.text("Altro specificare", contract.otherType, "Altra tipologia di contratto");
  fill.text("CCNL", contract.ccnl, "CCNL");
  fill.text("LivelloCategoria inquadramento", contract.level, "Livello/categoria");
  fill.text("Range retribuzione mensile", contract.monthlySalary, "Retribuzione mensile");
  fill.text("Range RAL", contract.annualSalary, "Range RAL");
  fill.text("Benefit", contract.benefits, "Benefit");
  fill.check(contract.fullTime ? "Tempo Pieno dalle" : "Tempo Parziale dalle");
  const drawTimes = fill.times(document.getPage(1), contract.fullTime, contract.from, contract.to);
  fill.text("N ore settimanali", contract.weeklyHours, "Ore settimanali");
  if (WORK_DAYS.every((day) => contract.days.includes(day))) fill.check("Tutta la settimana");
  else for (const day of contract.days) fill.check(DAY_FIELDS[day]);
  fill.check(contract.holidayWork ? "si" : "no");
  fill.check("In Azienda", contract.onSite);
  fill.check("undefined_3", contract.smartWorking);
  fill.text("Smart Working nei giorni", contract.smartWorkingDays, "Giorni di smart working");

  // Assunzioni agevolate
  for (const incentive of incentives.types) fill.check(INCENTIVE_FIELDS[incentive]);
  fill.text("Altro_2", incentives.other, "Altra agevolazione");
  fill.text("Mese previsto Assunzione", incentives.expectedHireMonth, "Mese previsto assunzione");
  fill.lines(["NOTE 1", "NOTE 2"], incentives.notes, "Note assunzioni agevolate");

  // Documentazione, note, consenso
  for (const item of documents.required) fill.check(DOCUMENT_FIELDS[item]);
  fill.text("undefined_5", documents.other, "Altro documento");
  fill.lines(
    [1, 2, 3, 4, 5].map((line) => `NOTE AGGIUNTIVE AZIENDA ${line}`),
    form.companyNotes,
    "Note aggiuntive azienda",
  );
  fill.text("IlLa sottoscrittoa", form.consent.signatoryName, "Legale rappresentante");
  fill.check("Do il consenso", form.consent.granted);

  const pdfForm = document.getForm();
  pdfForm.updateFieldAppearances(font);
  pdfForm.flatten();
  drawTimes();

  const stamp = `Richiesta ${meta.code} · revisione ${meta.revision} · generata il ${meta.generatedAt.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}`;
  document.getPages().forEach((page, index, pages) => {
    const label = `${stamp} · pagina ${index + 1} di ${pages.length}`;
    page.drawText(label, { x: 40, y: page.getHeight() - 14, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
  });

  document.setTitle(`Job Description ${meta.code} rev. ${meta.revision}`);
  document.setProducer("ADV_HR");
  document.setCreationDate(meta.generatedAt);
  document.setModificationDate(meta.generatedAt);
  return document.save();
}
