"use client";

import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmButton } from "@/components/common/confirm-button";
import { FilterSelect } from "@/components/common/filter-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DOCUMENT_PROCESSING_LABELS, DOCUMENT_TYPE_LABELS, optionsOf } from "@/config/labels";
import { ALLOWED_DOCUMENT_MIME_TYPES, type DocumentMetadata, type DocumentType } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatDateTime, formatFileSize } from "@/lib/format";

import { deleteDocumentAction, uploadDocumentAction } from "../server/actions";

type Owner = { candidateId: string } | { companyId: string } | { selectionId: string };

const ACCEPT = Object.entries(ALLOWED_DOCUMENT_MIME_TYPES)
  .flatMap(([mime, extensions]) => [mime, ...extensions])
  .join(",");

interface DocumentsPanelProps {
  owner: Owner;
  documents: DocumentMetadata[];
  allowedTypes: DocumentType[];
  canManage: boolean;
  title?: string;
}

/**
 * Documenti di un'entità: solo metadati nel database, file nello storage.
 * Formati ammessi: PDF, Word, ODT, JPG, PNG, TXT — max 10 MB (verificato server-side).
 */
export function DocumentsPanel({
  owner,
  documents,
  allowedTypes,
  canManage,
  title = "Documenti",
}: DocumentsPanelProps) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType | undefined>(allowedTypes[0]);
  const [uploading, setUploading] = useState(false);
  const remove = useActionMutation(deleteDocumentAction, { successMessage: "Documento eliminato" });

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !type) {
      toast.error("Seleziona tipo e file da caricare");
      return;
    }
    const formData = new FormData();
    for (const [key, value] of Object.entries(owner)) formData.set(key, value);
    formData.set("type", type);
    formData.set("file", file);

    setUploading(true);
    try {
      const result = await uploadDocumentAction(formData);
      if (result.ok) {
        toast.success("Documento caricato", { description: result.data.filename });
        if (fileRef.current) fileRef.current.value = "";
      } else {
        toast.error("Caricamento non riuscito", { description: result.error });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card role="region" aria-labelledby={`${fileInputId}-title`}>
      <CardHeader>
        <h3 id={`${fileInputId}-title`} className="text-base leading-snug font-medium">
          {title}
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <form
            onSubmit={upload}
            className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center"
          >
            <FilterSelect
              label="Tipo di documento"
              allLabel="Tipo di documento…"
              value={type}
              options={optionsOf(DOCUMENT_TYPE_LABELS).filter((option) => allowedTypes.includes(option.value))}
              onChange={(value) => setType(value as DocumentType | undefined)}
            />
            <label htmlFor={fileInputId} className="sr-only">
              File da caricare
            </label>
            <input
              id={fileInputId}
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              required
              disabled={uploading}
              className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-2.5 file:py-1 file:text-sm file:font-medium"
            />
            <Button type="submit" size="sm" disabled={uploading}>
              {uploading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
              {uploading ? "Caricamento…" : "Carica"}
            </Button>
          </form>
        )}
        {canManage && <p className="text-xs text-muted-foreground">PDF, Word, ODT, JPG, PNG o TXT · massimo 10 MB.</p>}

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun documento caricato.</p>
        ) : (
          <ul className="divide-y">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={document.filename}>
                      {document.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_TYPE_LABELS[document.type]} · {formatFileSize(document.sizeBytes)} ·{" "}
                      {formatDateTime(document.createdAt)}
                      {document.uploadedBy && ` · ${document.uploadedBy.displayName}`}
                      {document.processingStatus !== "UPLOADED" &&
                        ` · ${DOCUMENT_PROCESSING_LABELS[document.processingStatus]}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {/* Link reale (ruolo "link"): il download passa dalla route protetta. */}
                  <a
                    href={`/api/documents/${document.id}`}
                    download
                    aria-label={`Scarica ${document.filename}`}
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                  >
                    <Download aria-hidden="true" />
                  </a>
                  {canManage && (
                    <ConfirmButton
                      size="icon-sm"
                      aria-label={`Elimina ${document.filename}`}
                      title="Eliminare il documento?"
                      description={`"${document.filename}" verrà eliminato definitivamente dallo storage.`}
                      confirmLabel="Elimina"
                      onConfirm={() => remove.mutateAsync({ documentId: document.id })}
                    >
                      <Trash2 aria-hidden="true" />
                    </ConfirmButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
