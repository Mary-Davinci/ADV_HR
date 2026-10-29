import { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { servicesFor } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";

/** Formati che il browser può mostrare in sicurezza in una nuova finestra (`?view=1`). */
const VIEWABLE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

/**
 * Download di un documento. Autenticazione e permesso `document.read`
 * verificati server-side. Di norma il file è servito come allegato; con
 * `?view=1` PDF e immagini si aprono nel browser (gli altri formati restano download).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  try {
    const { document, content } = await servicesFor(user).documents.download(id);
    const encodedName = encodeURIComponent(document.filename);
    const inline = new URL(request.url).searchParams.get("view") === "1" && VIEWABLE_MIME_TYPES.has(document.mimeType);
    return new NextResponse(Buffer.from(content), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }
}
