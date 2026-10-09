import { randomUUID } from "node:crypto";

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DomainRuleError,
  MAX_DOCUMENT_SIZE_BYTES,
  type ActivityEntityType,
  type DocumentMetadata,
  type DocumentType,
  type EntityId,
} from "@/domain";
import { assertCan } from "@/lib/auth/permissions";
import type { DocumentOwner } from "@/repositories/types";

import { NotFoundError, nowOf, recordEvent, type ServiceContext } from "./context";
import { createDocumentProcessingService, type DocumentProcessingService } from "./document-processing";
import type { DocumentStorage } from "./storage/document-storage";

export interface UploadedFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** Firme binarie ("magic numbers"): il contenuto deve corrispondere al tipo dichiarato. */
function contentMatchesMimeType(bytes: Uint8Array, mimeType: string): boolean {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  switch (mimeType) {
    case "application/pdf":
      return startsWith(0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.oasis.opendocument.text":
      return startsWith(0x50, 0x4b, 0x03, 0x04); // ZIP
    case "application/msword":
      return startsWith(0xd0, 0xcf, 0x11, 0xe0);
    case "text/plain":
      return !bytes.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}

/** Nome file sicuro da mostrare/scaricare: niente percorsi né caratteri di controllo. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "documento";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "_").trim();
  return (cleaned || "documento").slice(0, 200);
}

export function validateUpload(file: UploadedFile): void {
  const extensions = ALLOWED_DOCUMENT_MIME_TYPES[file.mimeType];
  if (!extensions) throw new DomainRuleError("Formato file non consentito.", "FILE_TYPE");
  const lowerName = file.name.toLowerCase();
  if (!extensions.some((extension) => lowerName.endsWith(extension))) {
    throw new DomainRuleError("L'estensione del file non corrisponde al formato.", "FILE_EXTENSION");
  }
  if (file.bytes.byteLength === 0) throw new DomainRuleError("Il file è vuoto.", "FILE_EMPTY");
  if (file.bytes.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new DomainRuleError("Il file supera la dimensione massima di 10 MB.", "FILE_SIZE");
  }
  if (!contentMatchesMimeType(file.bytes, file.mimeType)) {
    throw new DomainRuleError("Il contenuto del file non corrisponde al formato dichiarato.", "FILE_CONTENT");
  }
}

function ownerContext(owner: DocumentOwner): { entityType: ActivityEntityType; entityId: EntityId } {
  if (owner.candidateId) return { entityType: "CANDIDATE", entityId: owner.candidateId };
  if (owner.applicationId) return { entityType: "APPLICATION", entityId: owner.applicationId };
  if (owner.selectionId) return { entityType: "SELECTION", entityId: owner.selectionId };
  if (owner.companyId) return { entityType: "COMPANY", entityId: owner.companyId };
  throw new DomainRuleError("Il documento deve essere associato a un'entità.", "DOCUMENT_OWNER");
}

export function createDocumentService(
  context: ServiceContext,
  storage: DocumentStorage,
  processing: DocumentProcessingService = createDocumentProcessingService(),
) {
  const { store, actor } = context;

  async function ownerExists(owner: DocumentOwner): Promise<boolean> {
    if (owner.candidateId) return Boolean(await store.candidates.getById(owner.candidateId));
    if (owner.selectionId) return Boolean(await store.selections.getById(owner.selectionId));
    if (owner.companyId) return Boolean(await store.companies.getById(owner.companyId));
    if (owner.applicationId) return Boolean(await store.applications.getById(owner.applicationId));
    return false;
  }

  return {
    list(owner: DocumentOwner) {
      assertCan(actor, "document.read");
      return store.documents.list(owner);
    },

    async upload(owner: DocumentOwner, type: DocumentType, file: UploadedFile): Promise<DocumentMetadata> {
      assertCan(actor, "document.manage");
      validateUpload(file);
      const { entityType, entityId } = ownerContext(owner);
      if (!(await ownerExists(owner))) throw new NotFoundError("Elemento di destinazione non trovato.");

      const now = nowOf(context);
      // Chiave generata dal server: il nome originale non entra mai nel percorso.
      const storageKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
      await storage.put(storageKey, file.bytes);

      try {
        return await store.transaction(async (repos) => {
          const document = await repos.documents.create({
            owner,
            type,
            filename: sanitizeFilename(file.name),
            storageProvider: storage.provider,
            storageKey,
            mimeType: file.mimeType,
            sizeBytes: file.bytes.byteLength,
            uploadedBy: actor.id,
          });
          const status = processing.initialStatus(document);
          if (status !== document.processingStatus) await repos.documents.updateProcessingStatus(document.id, status);

          await recordEvent(repos, actor, {
            activity: {
              entityType: "DOCUMENT",
              entityId: document.id,
              action: "DOCUMENT_UPLOADED",
              candidateId: owner.candidateId ?? null,
              selectionId: owner.selectionId ?? null,
              companyId: owner.companyId ?? null,
              metadata: { type, owner: entityType, ownerId: entityId },
            },
            audit: {
              entityType: "DOCUMENT",
              entityId: document.id,
              action: "UPLOAD",
              changes: { type, mimeType: file.mimeType, sizeBytes: file.bytes.byteLength },
            },
          });
          return { ...document, processingStatus: status };
        });
      } catch (error) {
        // Metadati non salvati: rimuove il file per non lasciare orfani.
        await storage.delete(storageKey).catch(() => undefined);
        throw error;
      }
    },

    async download(id: EntityId): Promise<{ document: DocumentMetadata; content: Uint8Array }> {
      assertCan(actor, "document.read");
      const document = await store.documents.getById(id);
      if (!document || document.storageProvider !== storage.provider) throw new NotFoundError("Documento non trovato.");
      const content = await storage.get(document.storageKey);
      if (!content) throw new NotFoundError("File non disponibile nello storage.");
      return { document, content };
    },

    async remove(id: EntityId): Promise<void> {
      assertCan(actor, "document.manage");
      const document = await store.documents.getById(id);
      if (!document) throw new NotFoundError("Documento non trovato.");
      await store.transaction(async (repos) => {
        await repos.documents.delete(id);
        await recordEvent(repos, actor, {
          activity: {
            entityType: "DOCUMENT",
            entityId: id,
            action: "DOCUMENT_DELETED",
            candidateId: document.candidateId,
            selectionId: document.selectionId,
            companyId: document.companyId,
            metadata: { type: document.type },
          },
          audit: { entityType: "DOCUMENT", entityId: id, action: "DELETE", changes: { type: document.type } },
        });
      });
      await storage.delete(document.storageKey).catch(() => undefined);
    },
  };
}
