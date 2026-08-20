import "server-only";

import type {
  AdminVideoDetail,
  AdminVideoListItem,
  ChapterInput,
  VideoMetadataInput,
} from "@/domain/admin-video";
import { prisma } from "@/server/db";

/**
 * Admin-only citanje/pisanje snimaka — paralelno sa `src/server/videos.ts`,
 * ali BEZ `published: true` filtera. Namerno drugi fajl: da filter ostane
 * "baked into" javne funkcije (vidi komentar tamo), admin pristup ne sme da
 * deli iste funkcije sa uslovnim filterom koji neko moze da zaboravi da
 * iskljuci.
 */

/** Sve snimke, ukljucujuci nacrte — za admin listu. */
export async function listAllVideos(): Promise<AdminVideoListItem[]> {
  const videos = await prisma.video.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { chapters: true } } },
  });

  return videos.map((video) => ({
    id: video.id,
    slug: video.slug,
    title: video.title,
    published: video.published,
    durationSeconds: video.durationSeconds,
    chapterCount: video._count.chapters,
  }));
}

/** Pun snimak za formu izmene, sa sirovim (relativnim) putanjama. */
export async function getVideoForEdit(id: string): Promise<AdminVideoDetail | null> {
  const video = await prisma.video.findUnique({
    where: { id },
    include: { chapters: { orderBy: { order: "asc" } } },
  });
  if (!video) return null;

  return {
    id: video.id,
    slug: video.slug,
    title: video.title,
    description: video.description,
    durationSeconds: video.durationSeconds,
    posterPath: video.posterPath,
    manifestPath: video.manifestPath,
    published: video.published,
    chapters: video.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      startSeconds: chapter.startSeconds,
      order: chapter.order,
    })),
  };
}

export async function createVideo(input: VideoMetadataInput): Promise<{ id: string }> {
  const video = await prisma.video.create({ data: { ...input, published: false } });
  return { id: video.id };
}

export async function updateVideoMetadata(id: string, input: VideoMetadataInput): Promise<void> {
  await prisma.video.update({ where: { id }, data: input });
}

export async function deleteVideo(id: string): Promise<void> {
  // `onDelete: Cascade` u schema.prisma brise i poglavlja — jedan poziv.
  await prisma.video.delete({ where: { id } });
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  await prisma.video.update({ where: { id }, data: { published } });
}

/**
 * Zameni SVA poglavlja snimka odjednom — isti obrazac kao
 * `prisma/seed.ts` (`deleteMany` + `createMany` u transakciji). `order` je
 * uvek pozicija u prosledjenom nizu (0-bazno, kontinualno), pa nikad ne moze
 * da udari u `@@unique([videoId, order])` — nema gap-ova ni kolizija jer se
 * lista uvek gradi iznova, nikad parcijalno azurira.
 */
export async function replaceChapters(videoId: string, chapters: readonly ChapterInput[]): Promise<void> {
  await prisma.$transaction([
    prisma.chapter.deleteMany({ where: { videoId } }),
    prisma.chapter.createMany({
      data: chapters.map((chapter, order) => ({ ...chapter, order, videoId })),
    }),
  ]);
}
