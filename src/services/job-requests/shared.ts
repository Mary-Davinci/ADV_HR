import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  DomainRuleError,
  type DocumentMetadata,
  type EntityId,
  type JobRequest,
  type JobRequestForm,
  type JobRequestFormValues,
  type JobRequestStatus,
} from "@/domain";
import type { DataStore, JobRequestUpdate, Repositories } from "@/repositories/types";

import { sanitizeFilename, validateUpload, type UploadedFile } from "../document-service";
import { companySubmittedEmail, hrNotificationEmail } from "../mail/job-request-emails";
import type { Mailer } from "../mail/mailer";
import type { DocumentStorage } from "../storage/document-storage";
import type { JobRequestPdfMeta } from "./job-request-pdf";

/** Generatore del PDF: iniettato (template su disco in produzione, finto nei test). */
export type JobRequestPdfRenderer = (form: JobRequestForm, meta: JobRequestPdfMeta) => Promise<Uint8Array>;

/** Dipendenze delle richieste di personale, condivise tra area HR e link pubblico. */
export interface JobRequestDependencies {
  storage: DocumentStorage;
  renderPdf: JobRequestPdfRenderer;
  mailer: Mailer;
  /** Modulo ufficiale vuoto, allegato all'invito come riferimento. */
  blankForm: () => Promise<Uint8Array>;
  /** Indirizzo pubblico di ADV_HR, senza "/" finale. */
  publicUrl: string;
  /** Destinatario delle notifiche HR se l'autore della richiesta non ha un'email utilizzabile. */
  hrFallbackEmail?: string;
}

/** Validità del link personale inviato all'azienda. */
export const ACCESS_LINK_DAYS = 30;

/** Formati accettati per il modulo firmato (scansione o PDF). */
export const SIGNED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** Token del link: 32 byte casuali (base64url). Nel database finisce solo lo SHA-256. */
export function newAccessToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashAccessToken(token) };
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const accessLink = (publicUrl: string, token: string) => `${publicUrl}/modulo/${token}`;
export const requestLink = (publicUrl: string, request: Pick<JobRequest, "id" | "companyId">) =>
  `${publicUrl}/companies/${request.companyId}/requests/${request.id}`;

export function pdfFilename(request: Pick<JobRequest, "code" | "revision">): string {
  return `Job Description ${request.code} rev ${request.revision}.pdf`;
}

export function signedFilename(request: Pick<JobRequest, "code" | "revision">, extension: string): string {
  return `Job Description firmata ${request.code} rev ${request.revision}${extension}`;
}

export function requireStatus(request: JobRequest, allowed: JobRequestStatus[], message: string) {
  if (!allowed.includes(request.status)) throw new DomainRuleError(message, "JOB_REQUEST_STATUS");
}

/**
 * Cambio di stato con timeline e audit nella stessa transazione.
 * `actorId` null = azione dell'azienda tramite link personale.
 */
export async function changeStatus(
  repos: Repositories,
  actorId: EntityId | null,
  request: JobRequest,
  to: JobRequestStatus,
  changes: JobRequestUpdate = {},
) {
  await repos.jobRequests.update(request.id, { ...changes, status: to });
  await repos.activities.record({
    actorId,
    entityType: "COMPANY",
    entityId: request.companyId,
    action: "STATUS_CHANGED",
    companyId: request.companyId,
    metadata: { jobRequest: request.code, from: request.status, to, ...(actorId ? {} : { via: "link" }) },
  });
  await repos.audit.record({
    actorId,
    entityType: "COMPANY",
    entityId: request.companyId,
    action: "UPDATE",
    changes: { jobRequest: request.id, from: request.status, to, via: actorId ? "hr" : "link" },
  });
}

/**
 * Modulo completo (validato) → READY. Il PDF viene generato subito: se un
 * testo non entra nel modulo ufficiale l'invio fallisce e resta modificabile.
 */
export async function submitForm(
  store: DataStore,
  deps: JobRequestDependencies,
  actorId: EntityId | null,
  request: JobRequest,
  values: JobRequestFormValues,
  form: JobRequestForm,
  now: Date,
): Promise<Uint8Array> {
  const pdf = await deps.renderPdf(form, { code: request.code, revision: request.revision, generatedAt: now });
  await store.transaction((repos) =>
    changeStatus(repos, actorId, request, "READY", {
      form: values,
      validatedForm: form,
      reviewNote: null,
      submittedAt: now,
    }),
  );
  return pdf;
}

/**
 * Salva il modulo firmato come documento dell'azienda (file nello storage,
 * metadati nel database) e porta la richiesta a SIGNED.
 */
export async function storeSignedDocument(
  store: DataStore,
  deps: JobRequestDependencies,
  actorId: EntityId | null,
  request: JobRequest,
  file: UploadedFile,
  now: Date,
): Promise<DocumentMetadata> {
  if (!SIGNED_MIME_TYPES.includes(file.mimeType)) {
    throw new DomainRuleError("Carica il modulo firmato in PDF, JPG o PNG.", "FILE_TYPE");
  }
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  const named = { ...file, name: sanitizeFilename(signedFilename(request, extension)) };
  validateUpload(named);

  const storageKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
  await deps.storage.put(storageKey, named.bytes);
  try {
    return await store.transaction(async (repos) => {
      const document = await repos.documents.create({
        owner: { companyId: request.companyId },
        type: "JOB_DESCRIPTION",
        filename: named.name,
        storageProvider: deps.storage.provider,
        storageKey,
        mimeType: named.mimeType,
        sizeBytes: named.bytes.byteLength,
        uploadedBy: actorId,
      });
      await repos.activities.record({
        actorId,
        entityType: "DOCUMENT",
        entityId: document.id,
        action: "DOCUMENT_UPLOADED",
        companyId: request.companyId,
        metadata: { type: "JOB_DESCRIPTION", owner: "COMPANY", ownerId: request.companyId },
      });
      await repos.audit.record({
        actorId,
        entityType: "DOCUMENT",
        entityId: document.id,
        action: "UPLOAD",
        changes: { type: "JOB_DESCRIPTION", mimeType: named.mimeType, sizeBytes: named.bytes.byteLength },
      });
      await changeStatus(repos, actorId, request, "SIGNED", { signedDocumentId: document.id });
      return document;
    });
  } catch (error) {
    await deps.storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

/** Email per le notifiche HR: autore della richiesta, altrimenti l'indirizzo di riserva. */
export async function hrRecipient(store: DataStore, deps: JobRequestDependencies, request: JobRequest) {
  const author = request.createdBy ? await store.users.getById(request.createdBy.id) : null;
  return author?.email ?? deps.hrFallbackEmail ?? null;
}

/**
 * Notifiche dopo che l'azienda ha inviato il modulo: PDF da firmare
 * all'azienda, avviso a HR. Un errore di invio non annulla l'operazione.
 */
export async function notifySubmitted(
  store: DataStore,
  deps: JobRequestDependencies,
  request: JobRequest,
  form: JobRequestForm,
  pdf: Uint8Array,
  token: string | null,
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];
  const hr = await hrRecipient(store, deps, request);
  if (token && request.recipientEmail) {
    tasks.push(
      deps.mailer.send(
        companySubmittedEmail({
          to: request.recipientEmail,
          companyName: form.company.name,
          code: request.code,
          revision: request.revision,
          link: accessLink(deps.publicUrl, token),
          pdf: { filename: pdfFilename(request), content: pdf, contentType: "application/pdf" },
          // Il mittente è una casella no-reply: le risposte dell'azienda vanno a HR.
          replyTo: hr,
        }),
      ),
    );
  }
  if (hr) {
    tasks.push(
      deps.mailer.send(
        hrNotificationEmail({
          to: hr,
          event: "submitted",
          companyName: form.company.name,
          code: request.code,
          role: form.profile.role,
          requestUrl: requestLink(deps.publicUrl, request),
        }),
      ),
    );
  }
  await settleMail(tasks);
}

export async function notifySigned(store: DataStore, deps: JobRequestDependencies, request: JobRequest) {
  const hr = await hrRecipient(store, deps, request);
  if (!hr || !request.validatedForm) return;
  await settleMail([
    deps.mailer.send(
      hrNotificationEmail({
        to: hr,
        event: "signed",
        companyName: request.validatedForm.company.name,
        code: request.code,
        role: request.validatedForm.profile.role,
        requestUrl: requestLink(deps.publicUrl, request),
      }),
    ),
  ]);
}

/** Le notifiche sono "best effort": si registra l'errore senza dati personali. */
async function settleMail(tasks: Array<Promise<unknown>>) {
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.name : "errore";
      console.error("[mail] notifica non inviata:", reason);
    }
  }
}
