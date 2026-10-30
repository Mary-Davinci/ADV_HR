import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { cache } from "react";

import type { SessionUser } from "@/domain";
import { requireUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { getDataStore } from "@/repositories";
import { createApplicationService } from "@/services/application-service";
import { createCandidateService } from "@/services/candidate-service";
import { createCompanyService, createSelectionService } from "@/services/company-service";
import type { ServiceContext } from "@/services/context";
import { createDashboardService, createReportService } from "@/services/dashboard-service";
import { createDocumentService } from "@/services/document-service";
import { createInterviewService } from "@/services/interview-service";
import { createJobRequestService, type JobRequestDependencies } from "@/services/job-request-service";
import { renderJobRequestPdf } from "@/services/job-requests/job-request-pdf";
import { createPublicJobRequestService } from "@/services/job-requests/public-job-request-service";
import { OutboxMailer, SmtpMailer, type Mailer } from "@/services/mail/mailer";
import type { DocumentStorage } from "@/services/storage/document-storage";
import { createDocumentStorage, readStorageConfig } from "@/services/storage/storage-config";
import { createTalentPoolService, createTaskService } from "@/services/task-service";

const globalForServices = globalThis as unknown as {
  __advHrStorage?: DocumentStorage;
  __advHrMailer?: Mailer;
  __advHrJobRequestTemplate?: Promise<Uint8Array>;
};

/** Modulo ufficiale "Allegato 1 – Job Description" (PDF con campi compilabili). */
const JOB_REQUEST_TEMPLATE = path.join(process.cwd(), "assets", "Job Description ADV.pdf");

function jobRequestTemplate(): Promise<Uint8Array> {
  globalForServices.__advHrJobRequestTemplate ??= readFile(JOB_REQUEST_TEMPLATE).then(
    (buffer) => new Uint8Array(buffer),
  );
  return globalForServices.__advHrJobRequestTemplate;
}

export function getDocumentStorage(): DocumentStorage {
  globalForServices.__advHrStorage ??= createDocumentStorage(readStorageConfig(process.env));
  return globalForServices.__advHrStorage;
}

/** SMTP se configurato; altrimenti le mail finiscono come .eml nella cartella outbox. */
export function getMailer(): Mailer {
  globalForServices.__advHrMailer ??= serverEnv.SMTP_HOST
    ? new SmtpMailer(
        {
          host: serverEnv.SMTP_HOST,
          port: serverEnv.SMTP_PORT,
          secure: serverEnv.SMTP_SECURE,
          user: serverEnv.SMTP_USER,
          password: serverEnv.SMTP_PASSWORD,
        },
        serverEnv.MAIL_FROM,
      )
    : new OutboxMailer(serverEnv.MAIL_OUTBOX_DIR, serverEnv.MAIL_FROM);
  return globalForServices.__advHrMailer;
}

function jobRequestDependencies(): JobRequestDependencies {
  return {
    storage: getDocumentStorage(),
    renderPdf: async (form, meta) => renderJobRequestPdf(await jobRequestTemplate(), form, meta),
    mailer: getMailer(),
    blankForm: jobRequestTemplate,
    publicUrl: serverEnv.APP_PUBLIC_URL,
    hrFallbackEmail: serverEnv.HR_NOTIFICATION_EMAIL,
  };
}

export function servicesFor(actor: SessionUser) {
  const context: ServiceContext = { store: getDataStore(), actor };
  return {
    actor,
    candidates: createCandidateService(context),
    applications: createApplicationService(context),
    companies: createCompanyService(context),
    selections: createSelectionService(context),
    interviews: createInterviewService(context),
    tasks: createTaskService(context),
    talentPools: createTalentPoolService(context),
    documents: createDocumentService(context, getDocumentStorage()),
    jobRequests: createJobRequestService(context, jobRequestDependencies()),
    dashboard: createDashboardService(context),
    reports: createReportService(context),
    users: getDataStore().users,
  };
}

export type Services = ReturnType<typeof servicesFor>;

/**
 * Servizi applicativi per l'utente autenticato della richiesta corrente.
 * L'autorizzazione di ogni operazione è verificata DENTRO i servizi.
 */
export const getServices = cache(async (): Promise<Services> => servicesFor(await requireUser()));

/**
 * Modulo Job Description compilato dall'azienda: NESSUNA sessione, ogni
 * operazione è autorizzata dal solo token del link personale.
 */
export function publicJobRequests() {
  return createPublicJobRequestService(getDataStore(), jobRequestDependencies());
}
