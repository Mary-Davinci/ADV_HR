"use server";

import { z } from "zod";

import { DomainRuleError, MAX_DOCUMENT_SIZE_BYTES } from "@/domain";
import { runAction } from "@/lib/server/action";
import { uuidSchema } from "@/lib/zod-helpers";

import {
  jobRequestFormSchema,
  requestIdSchema,
  reviewNoteSchema,
  saveJobRequestSchema,
  sendJobRequestSchema,
  createAndSendJobRequestSchema,
} from "../schemas";

export async function createJobRequestAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ companyId: uuidSchema }), revalidate: "all" },
    ({ companyId }, services) => services.jobRequests.create(companyId),
  );
}

export async function createAndSendJobRequestAction(input: unknown) {
  return runAction(
    input,
    { schema: createAndSendJobRequestSchema, revalidate: "all" },
    ({ companyId, email }, services) => services.jobRequests.createAndSend(companyId, email),
  );
}

export async function saveJobRequestDraftAction(input: unknown) {
  return runAction(input, { schema: saveJobRequestSchema, revalidate: "all" }, ({ requestId, values }, services) =>
    services.jobRequests.saveDraft(requestId, values),
  );
}

/** Validazione completa lato server (stesse regole del client): solo così la richiesta diventa READY. */
export async function completeJobRequestAction(input: unknown) {
  return runAction(input, { schema: saveJobRequestSchema, revalidate: "all" }, ({ requestId, values }, services) => {
    const parsed = jobRequestFormSchema.safeParse(values);
    if (!parsed.success) {
      throw new DomainRuleError(parsed.error.issues[0]?.message ?? "Modulo incompleto.", "JOB_REQUEST_INVALID");
    }
    return services.jobRequests.complete(requestId, values, parsed.data);
  });
}

const signedUploadSchema = z.object({
  requestId: uuidSchema,
  file: z
    .instanceof(File, { message: "Seleziona il modulo firmato" })
    .refine((file) => file.size > 0, "Il file è vuoto")
    .refine((file) => file.size <= MAX_DOCUMENT_SIZE_BYTES, "Il file supera i 10 MB"),
});

export async function uploadSignedJobRequestAction(formData: FormData) {
  const input = { requestId: formData.get("requestId"), file: formData.get("file") };
  return runAction(input, { schema: signedUploadSchema, revalidate: "all" }, async ({ requestId, file }, services) =>
    services.jobRequests.uploadSigned(requestId, {
      name: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    }),
  );
}

export async function reopenJobRequestAction(input: unknown) {
  return runAction(input, { schema: reviewNoteSchema, revalidate: "all" }, ({ requestId, note }, services) =>
    services.jobRequests.reopen(requestId, note),
  );
}

export async function approveJobRequestAction(input: unknown) {
  return runAction(input, { schema: requestIdSchema, revalidate: "all" }, ({ requestId }, services) =>
    services.jobRequests.approveAndOpenSelection(requestId),
  );
}

export async function cancelJobRequestAction(input: unknown) {
  return runAction(input, { schema: requestIdSchema, revalidate: "all" }, ({ requestId }, services) =>
    services.jobRequests.cancel(requestId),
  );
}

export async function sendJobRequestAction(input: unknown) {
  return runAction(input, { schema: sendJobRequestSchema, revalidate: "all" }, ({ requestId, email }, services) =>
    services.jobRequests.send(requestId, email),
  );
}
