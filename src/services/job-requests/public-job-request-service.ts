import type { JobRequest, JobRequestForm, JobRequestFormValues, JobRequestStatus } from "@/domain";
import type { DataStore } from "@/repositories/types";

import { NotFoundError } from "../context";
import type { UploadedFile } from "../document-service";
import {
  hashAccessToken,
  notifySigned,
  notifySubmitted,
  pdfFilename,
  requireStatus,
  storeSignedDocument,
  submitForm,
  type JobRequestDependencies,
} from "./shared";

/** Stati in cui il link dell'azienda funziona (dopo l'apertura della selezione viene disattivato). */
const LINK_STATUSES: JobRequestStatus[] = ["SENT", "READY", "SIGNED"];
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export class InvalidLinkError extends NotFoundError {
  constructor() {
    super("Il link non è valido o è scaduto. Contatta Accademia Da Vinci per riceverne uno nuovo.");
    this.name = "InvalidLinkError";
  }
}

/** Ciò che l'azienda vede: niente dati interni (autori, note HR, documenti). */
export interface PublicJobRequestView {
  code: string;
  revision: number;
  status: JobRequestStatus;
  companyName: string;
  form: JobRequestFormValues;
  /** Nota di correzione lasciata da HR alla riapertura. */
  correctionNote: string | null;
  expiresAt: Date;
}

/**
 * Richieste di personale lato azienda: nessun utente autenticato, ogni
 * operazione è autorizzata SOLO dal token del link personale.
 */
export function createPublicJobRequestService(
  store: DataStore,
  deps: JobRequestDependencies,
  now: () => Date = () => new Date(),
) {
  async function resolve(token: string): Promise<JobRequest> {
    if (!TOKEN_FORMAT.test(token)) throw new InvalidLinkError();
    const request = await store.jobRequests.getByAccessTokenHash(hashAccessToken(token));
    if (
      !request ||
      !LINK_STATUSES.includes(request.status) ||
      !request.accessExpiresAt ||
      request.accessExpiresAt.getTime() <= now().getTime()
    ) {
      throw new InvalidLinkError();
    }
    return request;
  }

  return {
    async view(token: string): Promise<PublicJobRequestView> {
      const request = await resolve(token);
      const company = await store.companies.getById(request.companyId);
      return {
        code: request.code,
        revision: request.revision,
        status: request.status,
        companyName: request.form.company.name || company?.name || "",
        form: request.form,
        correctionNote: request.status === "SENT" ? request.reviewNote : null,
        expiresAt: request.accessExpiresAt!,
      };
    },

    async saveDraft(token: string, values: JobRequestFormValues): Promise<void> {
      const request = await resolve(token);
      requireStatus(request, ["SENT"], "Il modulo è già stato inviato.");
      await store.jobRequests.update(request.id, { form: values });
    },

    /** `form` è il risultato della validazione completa di `values` (fatta dall'action). */
    async submit(token: string, values: JobRequestFormValues, form: JobRequestForm): Promise<void> {
      const request = await resolve(token);
      requireStatus(request, ["SENT"], "Il modulo è già stato inviato.");
      const pdf = await submitForm(store, deps, null, request, values, form, now());
      await notifySubmitted(store, deps, request, form, pdf, token);
    },

    async pdf(token: string): Promise<{ filename: string; content: Uint8Array }> {
      const request = await resolve(token);
      requireStatus(request, ["READY", "SIGNED"], "Il PDF sarà disponibile dopo l'invio del modulo completo.");
      const content = await deps.renderPdf(request.validatedForm!, {
        code: request.code,
        revision: request.revision,
        generatedAt: now(),
      });
      return { filename: pdfFilename(request), content };
    },

    async uploadSigned(token: string, file: UploadedFile): Promise<void> {
      const request = await resolve(token);
      requireStatus(
        request,
        ["READY"],
        "Il modulo firmato è già stato caricato o il modulo non è ancora stato inviato.",
      );
      await storeSignedDocument(store, deps, null, request, file, now());
      await notifySigned(store, deps, request);
    },
  };
}
