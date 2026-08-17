import type { NextRequest } from "next/server";

import { badRequest, notFound, ok } from "@/lib/api/http";
import { videoParamSchema } from "@/lib/api/schemas";
import { getPublishedVideoByIdOrSlug } from "@/server/videos";

/**
 * GET /api/videos/clip-01-bars
 * GET /api/videos/clx7k2p9a0000...
 *
 * Isti endpoint prima i slug i cuid. Neobjavljen ili nepostojeci video daje
 * 404 — po odgovoru se ne moze zakljuciti koji je od ta dva slucaja, pa se
 * postojanje nacrta ne otkriva.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  // `RouteContext` je globalan u Next 16, generise se u `next dev` / `next build`.
  // `params` je Promise od Next-a 15.
  context: RouteContext<"/api/videos/[idOrSlug]">,
) {
  const parsed = videoParamSchema.safeParse(await context.params);

  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const video = await getPublishedVideoByIdOrSlug(parsed.data.idOrSlug);

  if (!video) {
    return notFound(`Video "${parsed.data.idOrSlug}" ne postoji.`);
  }

  return ok(video);
}
