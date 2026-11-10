import { FileText } from "lucide-react";

import type { DocumentMetadata, DocumentType } from "@/domain";

const VIEWABLE = new Set(["application/pdf", "image/jpeg", "image/png"]);

/** Per i documenti importati la data di caricamento non coincide con quella del documento. */
export function DocumentLinks({ documents, type }: { documents: DocumentMetadata[]; type: DocumentType }) {
  const matching = documents
    .filter((document) => document.type === type)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (matching.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {matching.map((document, index) => {
        const viewable = VIEWABLE.has(document.mimeType);
        return (
          <a
            key={document.id}
            href={`/api/documents/${document.id}${viewable ? "?view=1" : ""}`}
            {...(viewable ? { target: "_blank", rel: "noopener" } : {})}
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            title={document.filename}
          >
            <FileText aria-hidden="true" className="size-3.5" />
            {viewable ? "Apri" : "Scarica"}
            {matching.length > 1 && ` (${index + 1})`}
          </a>
        );
      })}
    </span>
  );
}
