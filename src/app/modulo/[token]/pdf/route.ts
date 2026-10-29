import { NextResponse } from "next/server";

import { DomainRuleError } from "@/domain";
import { describeError } from "@/lib/server/action";
import { publicJobRequests } from "@/lib/server/services";
import { InvalidLinkError } from "@/services/job-requests/public-job-request-service";

/** PDF compilato da firmare, scaricabile dall'azienda con il solo link personale. */
export async function GET(_request: Request, { params }: RouteContext<"/modulo/[token]/pdf">) {
  const { token } = await params;
  try {
    const { filename, content } = await publicJobRequests().pdf(token);
    return new NextResponse(Buffer.from(content), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `attachment; filename="job-description.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof InvalidLinkError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof DomainRuleError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[modulo pdf]", describeError(error));
    return NextResponse.json({ error: "PDF non disponibile" }, { status: 500 });
  }
}
