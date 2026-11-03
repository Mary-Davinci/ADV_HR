/**
 * Porta nel portale gli annunci ancora pubblicati su Zoho Recruit (export del 2 novembre 2026,
 * solo 2025-2026 e con azienda nota). Ogni annuncio diventa una selezione Aperta con l'annuncio
 * in BOZZA: nulla è visibile finché l'HR non lo rivede e preme «Pubblica annuncio».
 *
 *   npm run import:zoho-postings            mostra cosa verrebbe creato, senza scrivere
 *   npm run import:zoho-postings -- --apply crea selezioni e bozze
 *
 * Rieseguibile: un annuncio già importato (riconosciuto dal codice Zoho nelle note della
 * job description) viene saltato. In produzione: `railway run npm run import:zoho-postings`.
 */
import { randomUUID } from "node:crypto";

import { eq, ilike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { CareerBoard, PublicJobContent } from "@/domain/careers";
import type { WorkMode } from "@/domain";

import { activities, auditLogs, careerPostings, companies, jobDescriptions, recruitmentSelections } from "./schema";

/** Con P.IVA l'azienda deve già esistere (arriva da ADV Core); senza, è cercata per nome o creata. */
type CompanyRef = { name: string; vatNumber?: string; pattern?: string };
const ACCADEMIA: CompanyRef = { name: "ACCADEMIA DA VINCI SRL", vatNumber: "11173780963" };
const COPARM: CompanyRef = { name: "Coparm Srl", pattern: "%coparm%" };
const EQUAL_OPPORTUNITY = "Annuncio rivolto a candidati ambosessi (D.Lgs. 198/2006).";

type ZohoPosting = {
  zohoId: string;
  openedOn: string;
  company: CompanyRef;
  board: CareerBoard;
  city: string | null;
  province: string | null;
  region: string;
  workMode: WorkMode;
  content: PublicJobContent;
};

const TUTOR_DUTIES =
  "In sinergia con il personale di filiale, accompagnerà gli utenti nell'individuazione dei percorsi e dei servizi al lavoro previsti dai bandi della Regione:\n- attività di assessment;\n- accompagnamento all'inserimento lavorativo;\n- scouting delle opportunità.";
const TUTOR_REQUIREMENTS =
  "Titolo di studio:\n- laurea magistrale, specialistica o di vecchio ordinamento;\n- oppure laurea triennale con formazione specifica nelle metodologie dell'orientamento e nelle Politiche Attive del Lavoro, o con almeno un anno di esperienza nell'orientamento (istruzione, formazione o lavoro).\n\nCompletano il profilo:\n- ottime capacità comunicative e predisposizione all'ascolto;\n- flessibilità e orientamento al risultato;\n- conoscenza approfondita della lingua inglese;\n- capacità organizzativa e di pianificazione;\n- conoscenza dei portali regionali (SIUL, SIUF, Bandi Online);\n- autonomia nel raggiungimento della sede e disponibilità full time dal lunedì al venerdì.";

const POSTINGS: ZohoPosting[] = [
  {
    zohoId: "ZR_308_JOB",
    openedOn: "2025-06-17",
    company: ACCADEMIA,
    board: "Careers",
    city: "Milano",
    province: "MI",
    region: "Lombardia",
    workMode: "HYBRID",
    content: {
      title: "Docente per il corso «Aprire Attività di Servizi Amministrativi»",
      employer: "Accademia Da Vinci",
      location: "Milano e Fontanella (BG) – aula e/o FAD",
      summary:
        "Accademia Da Vinci, ente di formazione e agenzia per il lavoro accreditata nelle regioni Lombardia e Calabria, cerca docenti esperti per il corso «Aprire Attività di Servizi Amministrativi» (40 ore), pensato per formare professionisti in grado di gestire in autonomia un'attività di servizi amministrativi per aziende e professionisti.\n\nCertificazioni rilasciate ai corsisti: attestato di frequenza (70% delle ore) e attestato di competenza previo esame finale.\n\n" +
        EQUAL_OPPORTUNITY,
      duties:
        "Erogazione di uno o più moduli:\n- Procedure amministrative e normative di settore (20 ore);\n- Organizzazione aziendale ed elementi di diritto (10 ore);\n- Gestione informatizzata delle pratiche e degli archivi (10 ore).\n\nAl termine del corso i partecipanti dovranno saper usare i principali software d'ufficio, presidiare l'evoluzione della normativa di riferimento e gestire le procedure operative dell'attività amministrativa.",
      requirements:
        "- 2-3 anni di esperienza comprovata nei servizi amministrativi, nella gestione d'impresa o nella consulenza;\n- almeno 3 anni di esperienza come docente, con relativo titolo di studio;\n- ottime capacità didattiche e comunicative;\n- familiarità con i principali software gestionali e le normative di settore.",
      contract: "Docenza: corso di 40 ore in aula e/o FAD, massimo 8 ore al giorno dal lunedì al venerdì",
    },
  },
  {
    zohoId: "ZR_316_JOB",
    openedOn: "2025-09-09",
    company: ACCADEMIA,
    board: "Careers",
    city: "Milano",
    province: "MI",
    region: "Lombardia",
    workMode: "HYBRID",
    content: {
      title: "Tutor politiche attive",
      employer: "Accademia Da Vinci",
      location: "Milano o Sesto San Giovanni (MI)",
      summary:
        "Hai esperienza nell'erogazione delle politiche attive per il lavoro? Accademia Da Vinci, ente di formazione e agenzia per il lavoro accreditata con la Regione Lombardia, ricerca per ampliamento organico un/una tutor esperto/a politiche attive.\n\n" +
        EQUAL_OPPORTUNITY,
      duties: TUTOR_DUTIES,
      requirements: TUTOR_REQUIREMENTS,
      contract: "Full time lun-ven, 5° livello CCNL Commercio – buoni pasto, 2 venerdì al mese in smart working",
    },
  },
  {
    zohoId: "ZR_318_JOB",
    openedOn: "2025-10-10",
    company: ACCADEMIA,
    board: "Careers",
    city: "Fontanella",
    province: "BG",
    region: "Lombardia",
    workMode: "HYBRID",
    content: {
      title: "Tutor politiche attive – Fontanella",
      employer: "Accademia Da Vinci",
      location: "Fontanella (BG)",
      summary:
        "Hai esperienza nell'erogazione delle politiche attive per il lavoro? Accademia Da Vinci, ente di formazione e agenzia per il lavoro accreditata con la Regione Lombardia, ricerca per ampliamento organico un/una tutor esperto/a politiche attive full time per la sede di Fontanella.\n\n" +
        EQUAL_OPPORTUNITY,
      duties: TUTOR_DUTIES,
      requirements: TUTOR_REQUIREMENTS,
      contract: "Full time lun-ven, CCNL Commercio – buoni pasto, venerdì in smart working",
    },
  },
  {
    zohoId: "ZR_320_JOB",
    openedOn: "2025-10-16",
    company: ACCADEMIA,
    board: "Careers",
    city: "Busto Arsizio",
    province: "VA",
    region: "Lombardia",
    workMode: "HYBRID",
    content: {
      title: "Operatore/Operatrice dei servizi per il lavoro",
      employer: "Accademia Da Vinci",
      location: "Busto Arsizio (VA), viale Duca d'Aosta 19",
      summary:
        "Accademia Da Vinci, ente di formazione e agenzia per il lavoro accreditata presso Regione Lombardia, ricerca un/una operatore/operatrice dei servizi per il lavoro per ampliamento del proprio organico presso la sede di Busto Arsizio.\n\n" +
        EQUAL_OPPORTUNITY,
      duties:
        "In collaborazione con il team di filiale, accompagnerà gli utenti nella definizione di percorsi personalizzati e nell'accesso ai servizi previsti dai bandi regionali:\n- assessment delle competenze e dei bisogni;\n- accompagnamento all'inserimento lavorativo;\n- scouting di opportunità occupazionali.",
      requirements:
        "Titolo di studio (uno dei seguenti):\n- laurea magistrale, specialistica o di vecchio ordinamento;\n- laurea triennale con formazione specifica nelle metodologie dell'orientamento e nelle Politiche Attive del Lavoro, oppure almeno 1 anno di esperienza nell'orientamento;\n- diploma di scuola secondaria superiore con formazione specifica e almeno 2 anni di esperienza, oppure almeno 3 anni di esperienza nell'orientamento.\n\nCompetenze:\n- ottime capacità comunicative e di ascolto;\n- flessibilità e orientamento al risultato;\n- conoscenza approfondita della lingua inglese;\n- buone capacità organizzative e di pianificazione;\n- familiarità con i portali regionali (SIUL, SIUF, Bandi Online);\n- patente B e disponibilità a spostamenti.",
      contract:
        "Full time lun-ven 9:00-18:00, CCNL Commercio – 2 venerdì al mese in smart working, PC aziendale, assistenza sanitaria",
    },
  },
  {
    zohoId: "ZR_322_JOB",
    openedOn: "2025-11-24",
    company: COPARM,
    board: "aziende",
    city: "Ferrandina",
    province: "MT",
    region: "Basilicata",
    workMode: "ONSITE",
    content: {
      title: "Legal compliance – internal auditor",
      employer: "Coparm Srl",
      location: "Ferrandina (MT)",
      summary:
        "Accademia Da Vinci, agenzia per il lavoro, ricerca e seleziona per conto di Coparm Srl, azienda leader nella progettazione e realizzazione di impianti industriali, un/una Legal Compliance – Internal Auditor con esperienza.\n\n" +
        EQUAL_OPPORTUNITY,
      duties:
        "- Monitoraggio e implementazione delle normative di compliance aziendale (D.Lgs. 231/2001, GDPR, D.Lgs. 101/2018, NIS2);\n- redazione e aggiornamento della documentazione legale e dei contratti aziendali;\n- auditing interno e verifica della conformità dei processi a normative e policy;\n- analisi dei rischi legali e operativi, con reportistica periodica;\n- assistenza negli audit di enti esterni e autorità competenti;\n- supporto nella gestione della privacy e della protezione dei dati;\n- sviluppo di procedure per il miglioramento continuo in materia di compliance;\n- report e documentazione per il management e gli organi di controllo.",
      requirements:
        "- Laurea in Giurisprudenza;\n- almeno 5 anni di esperienza in ambito legale, preferibilmente in contesti industriali;\n- abilitazione alla professione di avvocato (preferenziale);\n- conoscenza approfondita di D.Lgs. 231/2001, GDPR e D.Lgs. 101/2018, Direttiva NIS2;\n- conoscenza dei sistemi di gestione qualità (ISO 9001, ISO 14001) e della normativa sulla sicurezza sul lavoro;\n- capacità analitiche, organizzative e di redazione di report e documenti legali;\n- buona padronanza degli strumenti informatici;\n- inglese almeno B1;\n- automunito/a.",
      contract: "Full time 5 giorni a settimana, 8:30-12:45 / 14:00-17:45",
    },
  },
  {
    zohoId: "ZR_330_JOB",
    openedOn: "2026-01-13",
    company: ACCADEMIA,
    board: "Careers",
    city: null,
    province: null,
    region: "Calabria",
    workMode: "REMOTE",
    content: {
      title: "Esperto/a per il Comitato Tecnico Scientifico – appalti e contratti pubblici",
      employer: "Accademia Da Vinci",
      location: "Da remoto",
      summary:
        "Accademia Da Vinci, ente di formazione a supporto delle imprese e della pubblica amministrazione, ricerca esperti/e per la costituzione di un Comitato Tecnico Scientifico dedicato alla progettazione di percorsi formativi in materia di appalti e contratti pubblici. La collaborazione ha natura consulenziale.",
      duties:
        "- Supporto alla progettazione scientifica dei percorsi formativi;\n- definizione di contenuti e indirizzi metodologici;\n- partecipazione a riunioni di confronto tecnico-scientifico.",
      requirements:
        "- Laurea magistrale in diritto pubblico, costituzionale, amministrativo, dell'Unione Europea o privato, ingegneria gestionale, politica economica o economia aziendale;\n- 10 anni di esperienza di docenza in questi ambiti o su programmazione, progettazione, affidamento ed esecuzione dei contratti pubblici (es. project management, BIM, codice dei contratti pubblici);\n- capacità di analisi e di lavoro collegiale.",
      contract: "Collaborazione consulenziale, da remoto",
    },
  },
  {
    zohoId: "ZR_331_JOB",
    openedOn: "2026-01-16",
    company: ACCADEMIA,
    board: "Careers",
    city: "Milano",
    province: "MI",
    region: "Lombardia",
    workMode: "HYBRID",
    content: {
      title: "Recruiter Middle / Senior – Ricerca e selezione",
      employer: "Accademia Da Vinci",
      location: "Milano",
      summary:
        "Accademia Da Vinci, ente di formazione e agenzia per il lavoro, per il potenziamento del proprio gruppo ricerca un/una recruiter middle/senior con esperienza nella ricerca e selezione del personale e nell'headhunting, per clienti di diversi settori.\n\n" +
        EQUAL_OPPORTUNITY,
      duties:
        "- Ricerca e selezione di profili di ogni livello: impiegati, operai anche specializzati, addetti alla ristorazione, figure specializzate, middle e top management;\n- headhunting per profili qualificati e manageriali;\n- ricerca e selezione di categorie protette (L. 68/99);\n- sviluppo di una rete di partner (enti, cooperative, associazioni) per l'inserimento di persone con disabilità;\n- orientamento in uscita per utenti del programma GOL;\n- consulenza su placement, percorsi professionali e matching domanda/offerta.",
      requirements:
        "- 2-4 anni di esperienza come recruiter;\n- autonomia nella gestione dell'intero processo di selezione;\n- buone capacità relazionali e di networking;\n- sensibilità verso inclusione lavorativa e politiche attive;\n- capacità organizzative e orientamento al risultato.",
      contract:
        "Contratto commisurato all'esperienza, netto €1.700-1.900 – buoni pasto, 1 giorno a settimana di smart working, premi sul fatturato",
    },
  },
  {
    zohoId: "ZR_342_JOB",
    openedOn: "2026-10-12",
    company: ACCADEMIA,
    board: "Careers",
    city: null,
    province: null,
    region: "Lombardia",
    workMode: "ONSITE",
    content: {
      title: "Consulente commerciale / Sales account (profilo junior)",
      employer: "Accademia Da Vinci",
      location: "Lombardia",
      summary:
        "Per l'ampliamento della nostra rete commerciale in Lombardia ricerchiamo un/una consulente commerciale – sales account interno/a, con esperienza nei servizi di consulenza e nei sistemi di finanziamento alle imprese.\n\nOffriamo crescita professionale in un ente strutturato e accreditato, CRM e strumenti professionali, supporto tecnico, progettuale e di back office interno. Benefit: auto, cellulare e computer aziendali.",
      duties:
        "- Sviluppo autonomo del portafoglio clienti (PMI e grandi aziende);\n- consulenza alle aziende su servizi formativi e per il lavoro;\n- gestione del ciclo commerciale: contatto, appuntamento, analisi dei fabbisogni, proposta;\n- monitoraggio delle statistiche di vendita, budget e proiezioni;\n- collaborazione con il team interno nella progettazione delle soluzioni.",
      requirements:
        "- Almeno 1 anno di esperienza nella vendita B2B, preferibilmente in formazione, consulenza o HR;\n- conoscenza degli strumenti di finanziamento (fondi interprofessionali, bandi regionali e nazionali, finanza agevolata);\n- capacità di generare nuovi contatti in autonomia;\n- ottime capacità relazionali e consulenziali, orientamento al risultato, proattività;\n- ottime competenze digitali;\n- possibilità di raggiungere agevolmente la sede di lavoro;\n- laurea in ambito economico e buona conoscenza dell'inglese (preferenziali).",
      contract: "Full time 40 ore lun-ven, CCNL Commercio, tempo determinato 6 mesi o indeterminato",
    },
  },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL mancante");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { casing: "snake_case" });

  try {
    const imported = new Set(
      (
        await db
          .select({ notes: jobDescriptions.notes })
          .from(jobDescriptions)
          .where(ilike(jobDescriptions.notes, "%ZR_%_JOB%"))
      ).flatMap((row) => row.notes?.match(/ZR_\d+_JOB/g) ?? []),
    );
    const pending = POSTINGS.filter((posting) => !imported.has(posting.zohoId));
    for (const posting of POSTINGS)
      console.log(
        `${imported.has(posting.zohoId) ? "già importato" : "da creare   "}  ${posting.zohoId}  ${posting.content.title}`,
      );
    if (!pending.length) return;

    await db.transaction(async (tx) => {
      const companyIds = new Map<string, string>();
      for (const company of new Set(pending.map((posting) => posting.company))) {
        const matches = await tx
          .select()
          .from(companies)
          .where(
            company.vatNumber ? eq(companies.vatNumber, company.vatNumber) : ilike(companies.name, company.pattern!),
          );
        if (company.vatNumber && !matches.length)
          throw new Error(`Azienda «${company.name}» (P.IVA ${company.vatNumber}) assente: sincronizzare ADV Core.`);
        if (matches.length > 1)
          throw new Error(`Più aziende corrispondono a «${company.name}»: ${matches.map((c) => c.name).join(", ")}`);
        console.log(matches[0] ? `Azienda esistente: ${matches[0].name}` : `Azienda da creare: ${company.name}`);
        if (!apply) continue;
        const [row] = matches.length ? matches : await tx.insert(companies).values({ name: company.name }).returning();
        companyIds.set(company.name, row!.id);
      }
      if (!apply) return;

      for (const posting of pending) {
        const companyId = companyIds.get(posting.company.name)!;
        const [selection] = await tx
          .insert(recruitmentSelections)
          .values({
            companyId,
            title: posting.content.title,
            status: "OPEN",
            openedAt: new Date(`${posting.openedOn}T09:00:00Z`),
          })
          .returning();
        await tx.insert(jobDescriptions).values({
          selectionId: selection!.id,
          title: posting.content.title,
          summary: posting.content.summary,
          duties: posting.content.duties,
          requirements: posting.content.requirements,
          employmentType: "FULL_TIME",
          workTime: "FULL_TIME",
          workMode: posting.workMode,
          locationCity: posting.city,
          locationProvince: posting.province,
          locationRegion: posting.region,
          notes: `Importato da Zoho Recruit (${posting.zohoId}), annuncio aperto il ${posting.openedOn}.`,
        });
        const slugTitle = posting.content.title
          .normalize("NFKD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 130);
        await tx.insert(careerPostings).values({
          selectionId: selection!.id,
          slug: `${slugTitle}-${randomUUID()}`,
          board: posting.board,
          content: posting.content,
          publishedAt: null,
        });
        await tx.insert(activities).values({
          entityType: "SELECTION",
          entityId: selection!.id,
          action: "CREATED",
          selectionId: selection!.id,
          companyId,
          metadata: { title: selection!.title, source: "ZOHO_IMPORT", zohoId: posting.zohoId },
        });
        await tx.insert(auditLogs).values({
          entityType: "SELECTION",
          entityId: selection!.id,
          action: "CREATE",
          changes: { source: "ZOHO_IMPORT", zohoId: posting.zohoId, publicPosting: "draft" },
        });
      }
    });
    console.log(
      apply ? `Create ${pending.length} selezioni con annuncio in bozza.` : "Anteprima: aggiungi --apply per scrivere.",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
