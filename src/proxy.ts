import { NextResponse, type NextRequest } from "next/server";

/**
 * Odgovara na CORS preflight za media fajlove.
 *
 * Next-ovo staticko serviranje ne zna za OPTIONS i vraca 400, a browser
 * trazi 2xx da bi pustio cross-origin zahtev sa `Range` headerom (Range nije
 * medju CORS-safelisted headerima, pa uvek okida preflight).
 *
 * Sami GET/HEAD zahtevi idu dalje na staticko serviranje — njima headere
 * dodaje `headers()` iz next.config.ts.
 *
 * U Next 16 se ovaj fajl zove `proxy.ts`; `middleware.ts` je deprecated.
 */
export default function proxy(request: NextRequest) {
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

export const config = {
  matcher: "/media/:path*",
};
