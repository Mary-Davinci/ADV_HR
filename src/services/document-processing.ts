import type { DocumentMetadata, DocumentProcessingStatus } from "@/domain";

/**
 * Predisposizione per l'elaborazione futura dei documenti (es. parsing CV).
 * In V1 NON esiste alcun parser, OCR o chiamata a servizi AI esterni:
 * i documenti restano nello stato `UPLOADED`.
 *
 * Ciclo di vita previsto:  UPLOADED → PENDING → PROCESSED | FAILED
 */
export interface DocumentProcessor {
  /** Es. "cv-parser@1". */
  readonly id: string;
  supports(document: Pick<DocumentMetadata, "type" | "mimeType">): boolean;
  process(
    document: DocumentMetadata,
    content: Uint8Array,
  ): Promise<{ status: Extract<DocumentProcessingStatus, "PROCESSED" | "FAILED"> }>;
}

export interface DocumentProcessingService {
  /** Stato iniziale da assegnare a un documento appena caricato. */
  initialStatus(document: Pick<DocumentMetadata, "type" | "mimeType">): DocumentProcessingStatus;
}

export function createDocumentProcessingService(processors: DocumentProcessor[] = []): DocumentProcessingService {
  return {
    initialStatus(document) {
      // Con un processor registrato il documento andrebbe in coda (PENDING).
      return processors.some((processor) => processor.supports(document)) ? "PENDING" : "UPLOADED";
    },
  };
}
