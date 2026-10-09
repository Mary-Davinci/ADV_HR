import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/callback-url";

/**
 * Controllo ottimistico delle route: reindirizza al login chi non ha
 * sessione. La verifica autorevole avviene nel DAL (`lib/auth/session.ts`).
 */
export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth?.user);
  const isLoginPage = pathname === "/login";

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
