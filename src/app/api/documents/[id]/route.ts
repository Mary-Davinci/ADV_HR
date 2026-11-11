import { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { servicesFor } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";
import { BROWSER_VIEWABLE_MIME_TYPES } from "@/domain/document";

/**
 * Isolamento del file aperto: niente script, richieste o contenuti esterni. I PDF non possono
 * stare in `sandbox` (Chrome ed Edge non avviano il visualizzatore), quindi ricevono solo i divieti.
 */
function contentSecurityPolicy(mimeType: string): string {
  const base = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  if (mimeType === "application/pdf") return `${base}; object-src 'self'; style-src 'unsafe-inline'`;
  return `sandbox; ${base}; img-src 'self'; style-src 'unsafe-inline'`;
}

/**
 * Download di un documento. Autenticazione e permesso `document.read`
 * verificati server-side. Di norma il file è servito come allegato; con
 * `?view=1` PDF, immagini e testo si aprono nel browser (gli altri formati restano download).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  try {
    const { document, content } = await servicesFor(user).documents.download(id);
    const encodedName = encodeURIComponent(document.filename);
    const inline =
      new URL(request.url).searchParams.get("view") === "1" && BROWSER_VIEWABLE_MIME_TYPES.includes(document.mimeType);
    return new NextResponse(Buffer.from(content), {
      headers: {
        // I .txt caricati dall'Italia sono quasi sempre UTF-8: senza charset il browser sbaglia gli accenti.
        "Content-Type": document.mimeType === "text/plain" ? "text/plain; charset=utf-8" : document.mimeType,
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": contentSecurityPolicy(document.mimeType),
        // Nessun altro sito può incorporare i documenti sfruttando la sessione di chi è loggato.
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }
}
