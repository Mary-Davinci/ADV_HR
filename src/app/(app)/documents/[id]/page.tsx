import { ArrowLeft, Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/common/button-link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DOCUMENT_TYPE_LABELS } from "@/config/labels";
import { BROWSER_VIEWABLE_MIME_TYPES, type DocumentMetadata } from "@/domain";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { servicesFor } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";
import { extractPreviewText } from "@/services/cv-text/extract-text";

export const metadata: Metadata = { title: "Anteprima documento", robots: { index: false } };

/** Torna alla scheda da cui il documento è stato caricato. */
function ownerHref(document: DocumentMetadata): string {
  if (document.candidateId) return `/recruiting/${document.candidateId}?tab=documents`;
  if (document.companyId && document.selectionId)
    return `/companies/${document.companyId}/selections/${document.selectionId}?tab=documents`;
  if (document.companyId) return `/companies/${document.companyId}`;
  return "/recruiting";
}

/**
 * Anteprima senza scaricare: i formati che il browser sa mostrare vanno alla route protetta;
 * Word e ODT mostrano il loro testo, estratto in locale con i limiti di sicurezza dei CV.
 */
export default async function DocumentPreviewPage({ params }: PageProps<"/documents/[id]">) {
  const user = await requirePermission("document.read");
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const download = await servicesFor(user)
    .documents.download(id)
    .catch(() => null);
  if (!download) notFound();
  const { document, content } = download;
  const preview = BROWSER_VIEWABLE_MIME_TYPES.includes(document.mimeType)
    ? null
    : extractPreviewText(content, document.mimeType);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ButtonLink variant="ghost" size="sm" className="-ml-2 text-muted-foreground" href={ownerHref(document)}>
        <ArrowLeft aria-hidden="true" />
        Torna alla scheda
      </ButtonLink>

      <Card>
        <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <FileText aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold break-words">{document.filename}</h1>
              <p className="text-sm text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[document.type]} · {formatFileSize(document.sizeBytes)} · caricato il{" "}
                {formatDateTime(document.createdAt)}
                {document.uploadedBy && ` da ${document.uploadedBy.displayName}`}
              </p>
            </div>
          </div>
          <a href={`/api/documents/${document.id}`} download className={buttonVariants({ variant: "outline" })}>
            <Download aria-hidden="true" />
            Scarica l&apos;originale
          </a>
        </CardHeader>
        <CardContent>
          {preview === null ? (
            <p className="text-sm">
              <a
                href={`/api/documents/${document.id}?view=1`}
                className="font-medium underline underline-offset-4"
                target="_blank"
                rel="noopener"
              >
                Apri il documento nel browser
              </a>
            </p>
          ) : preview.status === "OK" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Anteprima del solo testo: impaginazione, tabelle e immagini sono visibili nell&apos;originale.
              </p>
              <article className="max-h-[70svh] overflow-y-auto rounded-lg border bg-background p-5 text-sm leading-relaxed whitespace-pre-wrap">
                {preview.text}
              </article>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {preview.status === "UNSUPPORTED"
                ? "L'anteprima non è disponibile per questo formato (ad esempio i vecchi .doc): scarica l'originale per aprirlo."
                : preview.status === "EMPTY"
                  ? "Il documento non contiene testo da mostrare: scarica l'originale."
                  : "Non è stato possibile leggere il documento: scarica l'originale per aprirlo."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
