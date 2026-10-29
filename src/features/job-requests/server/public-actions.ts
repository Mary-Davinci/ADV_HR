"use server";

import { z } from "zod";

import { DomainRuleError, MAX_DOCUMENT_SIZE_BYTES } from "@/domain";
import { runPublicAction } from "@/lib/server/action";
import { publicJobRequests } from "@/lib/server/services";

import { accessTokenSchema, jobRequestFormSchema, publicSaveSchema } from "../schemas";

/**
 * Azioni del modulo compilato dall'azienda. Nessuna sessione: l'unica
 * autorizzazione è il token del link personale, verificato nel servizio
 * (esistenza, scadenza, stato della richiesta).
 */

export async function savePublicJobRequestAction(input: unknown) {
  return runPublicAction(input, publicSaveSchema, ({ token, values }) => publicJobRequests().saveDraft(token, values));
}

export async function submitPublicJobRequestAction(input: unknown) {
  return runPublicAction(input, publicSaveSchema, ({ token, values }) => {
    const parsed = jobRequestFormSchema.safeParse(values);
    if (!parsed.success) {
      throw new DomainRuleError(parsed.error.issues[0]?.message ?? "Modulo incompleto.", "JOB_REQUEST_INVALID");
    }
    return publicJobRequests().submit(token, values, parsed.data);
  });
}

const uploadSchema = z.object({
  token: accessTokenSchema,
  file: z
    .instanceof(File, { message: "Seleziona il modulo firmato" })
    .refine((file) => file.size > 0, "Il file è vuoto")
    .refine((file) => file.size <= MAX_DOCUMENT_SIZE_BYTES, "Il file supera i 10 MB"),
});

export async function uploadPublicSignedAction(formData: FormData) {
  const input = { token: formData.get("token"), file: formData.get("file") };
  return runPublicAction(input, uploadSchema, async ({ token, file }) =>
    publicJobRequests().uploadSigned(token, {
      name: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    }),
  );
}
