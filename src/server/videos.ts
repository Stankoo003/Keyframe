import "server-only";

import type { Paginated, VideoDetail, VideoListItem } from "@/domain/video";
import { mediaUrl } from "@/lib/media";
import { prisma } from "@/server/db";

/**
 * Citanje videa iz baze i prevodjenje u DTO oblike.
 *
 * Dve stvari se dese samo ovde:
 *   1. relativne putanje iz baze postaju puni URL-ovi (`mediaUrl`)
 *   2. Prisma vrsta se mapira u tip iz src/domain/video.ts
 *
 * Zbog (2) polja kao `manifestPath`, `published` i `updatedAt` nikad ne izadju
 * iz ovog fajla.
 */

/** Prisma vrsta prosirena brojem poglavlja. */
type VideoRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationSeconds: number;
  manifestPath: string;
  posterPath: string | null;
  _count: { chapters: number };
};

function toListItem(video: VideoRow): VideoListItem {
  return {
    id: video.id,
    slug: video.slug,
    title: video.title,
    description: video.description,
    durationSeconds: video.durationSeconds,
    // Base URL se dodaje tek ovde — u bazi stoji samo "hls/<slug>/master.m3u8".
    manifestUrl: mediaUrl(video.manifestPath),
    posterUrl: video.posterPath ? mediaUrl(video.posterPath) : null,
    chapterCount: video._count.chapters,
  };
}

/**
 * Stranica objavljenih videa.
 *
 * `published: true` je jedina zastita od curenja nacrta u javnu listu — stoji
 * ovde, a ne u route handleru, da se ne moze zaboraviti na novom pozivnom mestu.
 */
export async function listPublishedVideos({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}): Promise<Paginated<VideoListItem>> {
  const where = { published: true };

  // Jedna transakcija — inace `total` moze da se odnosi na drugo stanje baze
  // nego sama stranica.
  const [total, videos] = await prisma.$transaction([
    prisma.video.count({ where }),
    prisma.video.findMany({
      where,
      orderBy: { slug: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // `_count` broji poglavlja u bazi, bez povlacenja samih redova.
      include: { _count: { select: { chapters: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: videos.map(toListItem),
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page * pageSize < total,
    },
  };
}

/**
 * Jedan objavljen video, po `id`-u ili po `slug`-u.
 *
 * Jedan upit pokriva oba slucaja — nema pogadjanja koji je format stigao.
 * Neobjavljen video vraca `null`, pa endpoint daje 404 umesto da ga otkrije.
 */
export async function getPublishedVideoByIdOrSlug(idOrSlug: string): Promise<VideoDetail | null> {
  const video = await prisma.video.findFirst({
    where: {
      published: true,
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      chapters: { orderBy: { order: "asc" } },
      _count: { select: { chapters: true } },
    },
  });

  if (!video) return null;

  return {
    ...toListItem(video),
    chapters: video.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      startSeconds: chapter.startSeconds,
      order: chapter.order,
    })),
  };
}
