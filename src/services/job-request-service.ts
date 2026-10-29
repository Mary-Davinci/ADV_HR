import { randomInt } from "node:crypto";

import {
  DomainRuleError,
  initialJobRequestValues,
  type EntityId,
  type JobRequest,
  type JobRequestForm,
  type JobRequestFormValues,
  type WorkMode,
} from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type { CandidateSuggestion, JobDescriptionInput } from "@/repositories/types";

import { NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";
import type { UploadedFile } from "./document-service";
import { invitationEmail } from "./mail/job-request-emails";
import { educationSatisfies, searchCriteria, type JobSearchCriteria } from "./matching/job-criteria";
import {
  ACCESS_LINK_DAYS,
  accessLink,
  changeStatus,
  newAccessToken,
  notifySubmitted,
  pdfFilename,
  requireStatus,
  storeSignedDocument,
  submitForm,
  type JobRequestDependencies,
} from "./job-requests/shared";

export type { JobRequestDependencies, JobRequestPdfRenderer } from "./job-requests/shared";
export { pdfFilename, signedFilename } from "./job-requests/shared";

/** Candidato suggerito con l'esito del confronto sul titolo di studio. */
export interface SuggestedCandidate extends CandidateSuggestion {
  /** true = livello pari o superiore al richiesto; null = non confrontabile o non richiesto. */
  educationOk: boolean | null;
}

/** Codice leggibile e senza caratteri ambigui (niente 0/O, 1/I/L). */
function newCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return `JR-${Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
}

/** Dati strutturati della selezione ricavati dal modulo validato. */
export function jobDescriptionFromForm(form: JobRequestForm): JobDescriptionInput {
  const { profile, contract, incentives } = form;
  const workMode: WorkMode =
    contract.onSite && contract.smartWorking ? "HYBRID" : contract.smartWorking ? "REMOTE" : "ONSITE";
  const experience = { NONE: "nessuna", JUNIOR: "junior", SENIOR: "senior" }[profile.experience];
  const requirements = [
    `Esperienza richiesta: ${experience}`,
    profile.education && `Istruzione: ${profile.education}`,
    profile.drivingLicense && `Patente: ${profile.drivingLicense}`,
    profile.certifications && `Certificazioni: ${profile.certifications}`,
    profile.mandatoryRequirements && `Requisiti indispensabili: ${profile.mandatoryRequirements}`,
    `Disponibilità a trasferte: ${profile.travel ? "sì" : "no"}`,
  ].filter(Boolean);
  const contractLabel = {
    PERMANENT: "Tempo indeterminato",
    FIXED_TERM: `Tempo determinato (${contract.fixedTermMonths} mesi)`,
    INTERNSHIP: "Tirocinio",
    OTHER: contract.otherType ?? "Altro",
  }[contract.type];
  const notes = [
    `Contratto: ${contractLabel}`,
    contract.ccnl && `CCNL: ${contract.ccnl}${contract.level ? ` – livello ${contract.level}` : ""}`,
    contract.monthlySalary && `Retribuzione mensile: ${contract.monthlySalary}`,
    contract.annualSalary && `RAL: ${contract.annualSalary}`,
    contract.benefits && `Benefit: ${contract.benefits}`,
    contract.smartWorkingDays && `Smart working: ${contract.smartWorkingDays}`,
    `Posti: ${profile.positions}`,
    profile.expectedHireDate && `Assunzione prevista: ${profile.expectedHireDate.split("-").reverse().join("/")}`,
    incentives.expectedHireMonth && `Mese previsto assunzione: ${incentives.expectedHireMonth}`,
    incentives.notes && `Note assunzioni agevolate: ${incentives.notes}`,
    form.companyNotes && `Note dell'azienda: ${form.companyNotes}`,
  ].filter(Boolean);
  const dayNames = { MON: "lun", TUE: "mar", WED: "mer", THU: "gio", FRI: "ven", SAT: "sab", SUN: "dom" };

  return {
    title: profile.role,
    summary: profile.activities,
    duties: profile.duties,
    requirements: requirements.join("\n"),
    employmentType: null,
    workTime: contract.fullTime ? "FULL_TIME" : "PART_TIME",
    workMode,
    salaryMin: null,
    salaryMax: null,
    currency: "EUR",
    workingHours: `${contract.from}–${contract.to}, ${contract.weeklyHours} h/sett., ${contract.days.map((day) => dayNames[day]).join(" ")}${contract.holidayWork ? ", anche festivi" : ""}`,
    locationCity: profile.city,
    locationProvince: profile.province,
    locationRegion: null,
    notes: notes.join("\n").slice(0, 2000),
  };
}

/** Richieste di personale lato HR (utente autenticato, permessi verificati qui). */
export function createJobRequestService(context: ServiceContext, deps: JobRequestDependencies) {
  const { store, actor } = context;

  async function load(id: EntityId): Promise<JobRequest> {
    const request = await store.jobRequests.getById(id);
    if (!request) throw new NotFoundError("La richiesta non esiste.");
    return request;
  }

  /** Nuovo link personale all'azienda (invalida il precedente). La mail parte DENTRO la transazione. */
  async function sendLink(
    request: JobRequest,
    recipientEmail: string,
    changes: { revision?: number; reviewNote?: string | null; validatedForm?: null; signedDocumentId?: null } = {},
  ) {
    const now = nowOf(context);
    const { token, hash } = newAccessToken();
    const expiresAt = new Date(now.getTime() + ACCESS_LINK_DAYS * 86_400_000);
    const companyName = request.form.company.name || (await store.companies.getById(request.companyId))?.name || "";
    const blankForm = await deps.blankForm();
    await store.transaction(async (repos) => {
      await changeStatus(repos, actor.id, request, "SENT", {
        ...changes,
        recipientEmail,
        accessTokenHash: hash,
        accessExpiresAt: expiresAt,
        sentAt: now,
      });
      await deps.mailer.send(
        invitationEmail({
          to: recipientEmail,
          companyName,
          code: request.code,
          link: accessLink(deps.publicUrl, token),
          expiresAt,
          senderName: actor.name,
          replyTo: actor.email,
          blankForm: {
            filename: "Job Description - modulo vuoto.pdf",
            content: blankForm,
            contentType: "application/pdf",
          },
        }),
      );
    });
  }

  return {
    listByCompany(companyId: EntityId) {
      assertCan(actor, "selection.read");
      return store.jobRequests.listByCompany(companyId);
    },

    async getDetail(id: EntityId) {
      assertCan(actor, "selection.read");
      const request = await store.jobRequests.getById(id);
      if (!request) return null;
      const [company, signedDocument] = await Promise.all([
        store.companies.getById(request.companyId),
        request.signedDocumentId ? store.documents.getById(request.signedDocumentId) : null,
      ]);
      if (!company) return null;
      return { request, company, signedDocument };
    },

    /**
     * Candidati suggeriti per la job description compilata. Il sistema propone
     * e motiva (zona, titolo di studio, parole chiave nel CV): decide HR.
     */
    async suggestions(
      id: EntityId,
    ): Promise<{ criteria: JobSearchCriteria; total: number; items: SuggestedCandidate[] } | null> {
      assertCan(actor, "selection.read");
      assertCan(actor, "candidate.read");
      const request = await load(id);
      if (!request.validatedForm) return null;
      const criteria = searchCriteria(request.validatedForm);
      const { total, items } = await store.suggestions.suggest({
        province: criteria.province,
        keywords: criteria.keywords,
        selectionId: request.selectionId,
      });
      return {
        criteria,
        total,
        items: items.map((item) => ({
          ...item,
          educationOk: educationSatisfies(item.bestEducationLevel, criteria.minEducationLevel),
        })),
      };
    },

    /**
     * Crea la richiesta e la invia subito all'azienda (caso normale): nessun passaggio
     * dalla pagina della richiesta. Se la mail non parte, la richiesta non viene creata.
     */
    async createAndSend(companyId: EntityId, recipientEmail: string): Promise<{ id: EntityId; code: string }> {
      assertCan(actor, "selection.manage");
      const company = await store.companies.getById(companyId);
      if (!company) throw new NotFoundError("L'azienda non esiste.");
      const now = nowOf(context);
      const { token, hash } = newAccessToken();
      const expiresAt = new Date(now.getTime() + ACCESS_LINK_DAYS * 86_400_000);
      const blankForm = await deps.blankForm();
      return store.transaction(async (repos) => {
        const request = await repos.jobRequests.create({
          companyId,
          code: newCode(),
          form: initialJobRequestValues(company),
          createdBy: actor.id,
        });
        await recordEvent(repos, actor, {
          activity: {
            entityType: "COMPANY",
            entityId: companyId,
            action: "UPDATED",
            companyId,
            metadata: { section: "jobRequest", code: request.code },
          },
          audit: { entityType: "COMPANY", entityId: companyId, action: "UPDATE", changes: { jobRequest: request.id } },
        });
        await changeStatus(repos, actor.id, request, "SENT", {
          recipientEmail,
          accessTokenHash: hash,
          accessExpiresAt: expiresAt,
          sentAt: now,
        });
        await deps.mailer.send(
          invitationEmail({
            to: recipientEmail,
            companyName: company.name,
            code: request.code,
            link: accessLink(deps.publicUrl, token),
            expiresAt,
            senderName: actor.name,
            replyTo: actor.email,
            blankForm: {
              filename: "Job Description - modulo vuoto.pdf",
              content: blankForm,
              contentType: "application/pdf",
            },
          }),
        );
        return { id: request.id, code: request.code };
      });
    },

    async create(companyId: EntityId): Promise<{ id: EntityId }> {
      assertCan(actor, "selection.manage");
      const company = await store.companies.getById(companyId);
      if (!company) throw new NotFoundError("L'azienda non esiste.");
      return store.transaction(async (repos) => {
        const request = await repos.jobRequests.create({
          companyId,
          code: newCode(),
          form: initialJobRequestValues(company),
          createdBy: actor.id,
        });
        await recordEvent(repos, actor, {
          activity: {
            entityType: "COMPANY",
            entityId: companyId,
            action: "UPDATED",
            companyId,
            metadata: { section: "jobRequest", code: request.code },
          },
          audit: { entityType: "COMPANY", entityId: companyId, action: "UPDATE", changes: { jobRequest: request.id } },
        });
        return { id: request.id };
      });
    },

    /**
     * Invia (o reinvia) il modulo all'azienda: mail con link personale valido
     * ACCESS_LINK_DAYS giorni e modulo vuoto in allegato. Da DRAFT o SENT.
     */
    async send(id: EntityId, recipientEmail: string): Promise<void> {
      assertCan(actor, "selection.manage");
      const request = await load(id);
      requireStatus(
        request,
        ["DRAFT", "SENT"],
        "Il modulo è già stato compilato: per farlo correggere usa «Da correggere».",
      );
      await sendLink(request, recipientEmail);
    },

    /** Compilazione interna da parte di HR (es. dati dettati al telefono). */
    async saveDraft(id: EntityId, values: JobRequestFormValues): Promise<void> {
      assertCan(actor, "selection.manage");
      const request = await load(id);
      requireStatus(request, ["DRAFT"], "La richiesta non è modificabile (inviata all'azienda o già compilata).");
      await store.jobRequests.update(id, { form: values });
    },

    /** `form` è il risultato della validazione completa di `values` (fatta dall'action). */
    async complete(id: EntityId, values: JobRequestFormValues, form: JobRequestForm): Promise<void> {
      assertCan(actor, "selection.manage");
      const request = await load(id);
      requireStatus(request, ["DRAFT"], "La richiesta non è modificabile (inviata all'azienda o già compilata).");
      const pdf = await submitForm(store, deps, actor.id, request, values, form, nowOf(context));
      await notifySubmitted(store, deps, request, form, pdf, null);
    },

    async pdf(id: EntityId): Promise<{ filename: string; content: Uint8Array }> {
      assertCan(actor, "selection.read");
      const request = await load(id);
      if (!request.validatedForm || !["READY", "SIGNED", "OPENED"].includes(request.status)) {
        throw new DomainRuleError("Il PDF è disponibile solo per richieste complete.", "JOB_REQUEST_STATUS");
      }
      const content = await deps.renderPdf(request.validatedForm, {
        code: request.code,
        revision: request.revision,
        generatedAt: nowOf(context),
      });
      return { filename: pdfFilename(request), content };
    },

    async uploadSigned(id: EntityId, file: UploadedFile): Promise<void> {
      assertCan(actor, "selection.manage");
      assertCan(actor, "document.manage");
      const request = await load(id);
      requireStatus(request, ["READY"], "Si può caricare il firmato solo per una richiesta compilata.");
      await storeSignedDocument(store, deps, actor.id, request, file, nowOf(context));
    },

    /**
     * READY/SIGNED → nuova revisione modificabile: il PDF (o il firmato) precedente
     * non vale più. Se il modulo era stato inviato all'azienda, questa riceve un
     * nuovo link con la nota di correzione; altrimenti torna in bozza per HR.
     */
    async reopen(id: EntityId, note: string): Promise<void> {
      assertCan(actor, "selection.manage");
      const request = await load(id);
      requireStatus(request, ["READY", "SIGNED"], "Questa richiesta non può essere riaperta.");
      const changes = {
        revision: request.revision + 1,
        validatedForm: null,
        signedDocumentId: null,
        reviewNote: note,
      } as const;
      if (request.sentAt && request.recipientEmail) {
        await sendLink(request, request.recipientEmail, changes);
        return;
      }
      await store.transaction((repos) => changeStatus(repos, actor.id, request, "DRAFT", changes));
    },

    /**
     * SIGNED → OPENED: HR ha verificato firma, timbro e codice del modulo.
     * Crea la selezione (aperta) con la job description compilata dal modulo
     * e disattiva il link dell'azienda.
     */
    async approveAndOpenSelection(id: EntityId): Promise<{ selectionId: EntityId }> {
      assertCan(actor, "selection.manage");
      const request = await load(id);
      requireStatus(request, ["SIGNED"], "Serve il modulo firmato prima di aprire la selezione.");
      const form = request.validatedForm;
      if (!form || !request.signedDocumentId) {
        throw new DomainRuleError("Modulo validato o firmato mancante.", "JOB_REQUEST_INCOMPLETE");
      }
      const now = nowOf(context);
      const jobDescription = jobDescriptionFromForm(form);
      return store.transaction(async (repos) => {
        const selection = await repos.selections.create({
          companyId: request.companyId,
          title:
            form.profile.positions > 1 ? `${form.profile.role} (${form.profile.positions} posti)` : form.profile.role,
          status: "OPEN",
          openedAt: now,
          closedAt: null,
          createdBy: actor.id,
        });
        await repos.jobDescriptions.upsert(selection.id, jobDescription);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "SELECTION",
            entityId: selection.id,
            action: "CREATED",
            selectionId: selection.id,
            companyId: request.companyId,
            metadata: { title: selection.title, jobRequest: request.code },
          },
          audit: {
            entityType: "SELECTION",
            entityId: selection.id,
            action: "CREATE",
            changes: { jobRequest: request.id },
          },
        });
        await changeStatus(repos, actor.id, request, "OPENED", {
          selectionId: selection.id,
          approvedBy: actor.id,
          approvedAt: now,
          accessTokenHash: null,
        });
        return { selectionId: selection.id };
      });
    },

    async cancel(id: EntityId): Promise<void> {
      assertCan(actor, "selection.manage");
      const request = await load(id);
      requireStatus(request, ["DRAFT", "SENT", "READY", "SIGNED"], "Questa richiesta non può essere annullata.");
      await store.transaction((repos) =>
        changeStatus(repos, actor.id, request, "CANCELLED", { accessTokenHash: null }),
      );
    },
  };
}
