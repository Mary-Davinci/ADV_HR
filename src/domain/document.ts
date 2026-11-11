import type { EntityId, UserRef } from "./shared";

export const DOCUMENT_TYPES = [
  "CV",
  "COVER_LETTER",
  "CERTIFICATION",
  "IDENTITY_DOCUMENT",
  "JOB_DESCRIPTION",
  "SKILLS_ASSESSMENT",
  "ORIENTATION",
  "INTERVIEW_EVALUATION",
  "CONTRACT",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const STORAGE_PROVIDERS = ["LOCAL", "MEMORY", "S3"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

/** Stato di elaborazione (es. futuro parsing CV). Nessun parser è attivo in V1. */
export const DOCUMENT_PROCESSING_STATUSES = ["UPLOADED", "PENDING", "PROCESSED", "FAILED"] as const;
export type DocumentProcessingStatus = (typeof DOCUMENT_PROCESSING_STATUSES)[number];

/** Metadati del documento: il file binario vive nello storage, mai nel database. */
export interface DocumentMetadata {
  id: EntityId;
  candidateId: EntityId | null;
  applicationId: EntityId | null;
  companyId: EntityId | null;
  selectionId: EntityId | null;
  type: DocumentType;
  filename: string;
  storageProvider: StorageProvider;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  processingStatus: DocumentProcessingStatus;
  uploadedBy: UserRef | null;
  createdAt: Date;
}

/** Formati che il browser mostra da solo in una nuova scheda (`?view=1`). */
export const BROWSER_VIEWABLE_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
];
/** Formati Word/ODT: anteprima del testo nella pagina del gestionale. */
export const TEXT_PREVIEW_MIME_TYPES: readonly string[] = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
];

/** Dove porta il nome del file: anteprima nel browser, pagina di anteprima del testo o download. */
export function documentPreviewHref(document: Pick<DocumentMetadata, "id" | "mimeType">): string {
  if (BROWSER_VIEWABLE_MIME_TYPES.includes(document.mimeType)) return `/api/documents/${document.id}?view=1`;
  return `/documents/${document.id}`;
}

/** Whitelist dei formati accettati in upload. */
export const ALLOWED_DOCUMENT_MIME_TYPES: Record<string, readonly string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.oasis.opendocument.text": [".odt"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "text/plain": [".txt"],
};

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
