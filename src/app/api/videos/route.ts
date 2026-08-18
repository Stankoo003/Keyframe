import type { NextRequest } from "next/server";

import { badRequest, ok } from "@/lib/api/http";
import { listVideosQuerySchema } from "@/lib/api/schemas";
import { listPublishedVideos } from "@/server/videos";

/**
 * GET /api/videos?page=1&pageSize=12
 *
 * Vraca stranicu OBJAVLJENIH videa. Nacrti se ne pojavljuju.
 */

// Zavisi od stanja baze — ne sme da se prerenderuje u build-u.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = listVideosQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  return ok(await listPublishedVideos(parsed.data));
}
