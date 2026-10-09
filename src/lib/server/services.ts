import "server-only";

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
import { LocalFileStorage, type DocumentStorage } from "@/services/storage/document-storage";
import { createTalentPoolService, createTaskService } from "@/services/task-service";

const globalForStorage = globalThis as unknown as { __advHrStorage?: DocumentStorage };

function getDocumentStorage(): DocumentStorage {
  globalForStorage.__advHrStorage ??= new LocalFileStorage(serverEnv.DOCUMENT_STORAGE_DIR);
  return globalForStorage.__advHrStorage;
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
