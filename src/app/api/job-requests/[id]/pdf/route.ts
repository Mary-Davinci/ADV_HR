import { NextResponse } from "next/server";

import { DomainRuleError } from "@/domain";
import { ForbiddenError } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";
import { describeError } from "@/lib/server/action";
import { servicesFor } from "@/lib/server/services";
import { uuidSchema } from "@/lib/zod-helpers";

/**
 * PDF del modulo Job Description compilato, da stampare e far firmare.
 * Generato al volo dai dati validati della richiesta: mai da dati in bozza.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/job-requests/[id]/pdf">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  try {
    const { filename, content } = await servicesFor(user).jobRequests.pdf(id);
    return new NextResponse(Buffer.from(content), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `attachment; filename="job-description.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    if (error instanceof DomainRuleError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (!(error instanceof Error && error.name === "NotFoundError"))
      console.error("[job-request pdf]", describeError(error));
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }
}
