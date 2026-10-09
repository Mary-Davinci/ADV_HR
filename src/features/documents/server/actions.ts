"use server";

import { z } from "zod";

import { DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/domain";
import { runAction } from "@/lib/server/action";
import { uuidSchema } from "@/lib/zod-helpers";

const ownerSchema = z
  .object({
    candidateId: uuidSchema.optional(),
    companyId: uuidSchema.optional(),
    selectionId: uuidSchema.optional(),
  })
  .refine((owner) => Object.values(owner).filter(Boolean).length === 1, "Destinazione del documento non valida");

const uploadSchema = z.object({
  owner: ownerSchema,
  type: z.enum(DOCUMENT_TYPES),
  file: z
    .instanceof(File, { message: "Seleziona un file" })
    .refine((file) => file.size > 0, "Il file è vuoto")
    .refine((file) => file.size <= MAX_DOCUMENT_SIZE_BYTES, "Il file supera i 10 MB"),
});

/**
 * Upload via FormData. Controlli completi (whitelist MIME, estensione,
 * firma binaria, dimensione) nel DocumentService lato server.
 */
export async function uploadDocumentAction(formData: FormData) {
  const input = {
    owner: {
      candidateId: formData.get("candidateId") || undefined,
      companyId: formData.get("companyId") || undefined,
      selectionId: formData.get("selectionId") || undefined,
    },
    type: formData.get("type"),
    file: formData.get("file"),
  };
  return runAction(input, { schema: uploadSchema, revalidate: "all" }, async ({ owner, type, file }, services) => {
    const document = await services.documents.upload(owner, type, {
      name: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return { id: document.id, filename: document.filename };
  });
}

export async function deleteDocumentAction(input: unknown) {
  return runAction(
    input,
    { schema: z.object({ documentId: uuidSchema }), revalidate: "all" },
    ({ documentId }, services) => services.documents.remove(documentId),
  );
}
