import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/callback-url";

/**
 * Controllo ottimistico delle route: reindirizza al login chi non ha
 * sessione. La verifica autorevole avviene nel DAL (`lib/auth/session.ts`).
 */
export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  if ((pathname === "/jobs" || pathname.startsWith("/jobs/")) && process.env.CAREERS_ENABLED !== "true") {
    return new NextResponse("Portale candidature non disponibile", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const isLoggedIn = Boolean(request.auth?.user);
  const isLoginPage = pathname === "/login";
  const hostname = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  // The public jobs hostname has its own entry point; HR access stays on hr.*.
  if (hostname === "jobs.davinciformazione.com" && pathname !== "/jobs" && !pathname.startsWith("/jobs/")) {
    if (pathname === "/") return NextResponse.redirect(new URL("https://jobs.davinciformazione.com/jobs/aziende"));
    const hrUrl = new URL(process.env.APP_PUBLIC_URL ?? "https://hr.davinciformazione.com");
    hrUrl.pathname = pathname;
    hrUrl.search = search;
    return NextResponse.redirect(hrUrl);
  }

  // Modulo Job Description per le aziende: niente login, l'accesso è autorizzato
  // dal token del link personale (verificato nel servizio a ogni richiesta).
  if (pathname.startsWith("/modulo/")) return NextResponse.next();
  if (pathname === "/jobs" || pathname.startsWith("/jobs/")) return NextResponse.next();

  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_PATH, request.nextUrl));
  }

  if (!isLoginPage && !isLoggedIn) {
    const loginUrl = new URL("/login", request.nextUrl);
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
