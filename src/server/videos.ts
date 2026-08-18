import "server-only";

import { mediaUrl } from "@/lib/media";
import { prisma } from "@/server/db";

/**
 * Citanje videa iz baze.
 *
 * Ovde se relativne putanje iz baze pretvaraju u pune URL-ove. To je jedino
 * mesto gde se to desava — baza ne zna za host, a komponente ne znaju za
 * strukturu foldera.
 */

export type VideoWithUrls = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationSeconds: number;
  manifestUrl: string;
  posterUrl: string | null;
  chapters: { id: string; title: string; startSeconds: number; order: number }[];
};

/** Objavljeni videi, sa poglavljima poredanim po redosledu. */
export async function getPublishedVideos(): Promise<VideoWithUrls[]> {
  const videos = await prisma.video.findMany({
    where: { published: true },
    orderBy: { slug: "asc" },
    include: {
      chapters: { orderBy: { order: "asc" } },
    },
  });

  return videos.map((video) => ({
    id: video.id,
    slug: video.slug,
    title: video.title,
    description: video.description,
    durationSeconds: video.durationSeconds,
    // Base URL se dodaje tek ovde — u bazi stoji samo "hls/<slug>/master.m3u8".
    manifestUrl: mediaUrl(video.manifestPath),
    posterUrl: video.posterPath ? mediaUrl(video.posterPath) : null,
    chapters: video.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      startSeconds: chapter.startSeconds,
      order: chapter.order,
    })),
  }));
}
