import { NextResponse } from "next/server";

import { ForbiddenError } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { servicesFor } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";

/**
 * Download di un documento. Autenticazione e permesso `document.read`
 * verificati server-side; il file è sempre servito come allegato.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  try {
    const { document, content } = await servicesFor(user).documents.download(id);
    const encodedName = encodeURIComponent(document.filename);
    return new NextResponse(Buffer.from(content), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }
}
