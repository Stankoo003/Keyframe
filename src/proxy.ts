import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { ADMIN_SESSION_COOKIE, verifySession } from "@/server/auth/session";

/**
 * Dve nezavisne odgovornosti u istom middleware-u (Next dozvoljava samo jedan
 * `proxy.ts`), razdvojene po putanji:
 *
 * 1. CORS preflight za media fajlove — Next-ovo staticko serviranje ne zna za
 *    OPTIONS i vraca 400, a browser trazi 2xx da bi pustio cross-origin zahtev
 *    sa `Range` headerom (Range nije medju CORS-safelisted headerima, pa uvek
 *    okida preflight). Sami GET/HEAD zahtevi idu dalje na staticko serviranje
 *    — njima headere dodaje `headers()` iz next.config.ts.
 *
 * 2. Primarna barijera za `/admin/*` — anonimni pristup se ovde odbija, PRE
 *    nego sto bilo koja admin stranica ili Server Action i pocne da se
 *    izvrsava. `/admin/login` je namerno izuzet, inace bi login forma sama
 *    sebe redirektovala u beskonacnu petlju.
 *
 * U Next 16 se ovaj fajl zove `proxy.ts`; `middleware.ts` je deprecated.
 */
export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/media/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/admin") && request.nextUrl.pathname !== "/admin/login") {
    const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await verifySession(cookie, env.AUTH_SESSION_SECRET);
    if (!valid) return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/media/:path*", "/admin/:path*"],
};
