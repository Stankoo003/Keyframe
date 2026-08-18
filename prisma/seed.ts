/**
 * Seed — puni bazu enkodiranim klipovima.
 *
 * Pokretanje:  npm run db:seed
 *
 * Idempotentno je: uzastopna pokretanja daju isto stanje, ne duplikate.
 *
 * VAZNO — putanje su relativne ("hls/<slug>/master.m3u8"), bez hosta.
 * Base URL se dodaje pri citanju kroz `mediaUrl()`, pa isti podaci rade i
 * lokalno i na produkciji.
 */

import { config as loadEnv } from "dotenv";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });

/** Duzina HLS segmenta u sekundama — poglavlja padaju na te granice. */
const SEGMENT_SECONDS = 6;

type SeedClip = {
  slug: string;
  title: string;
  description: string;
  /** Izmereno sa `ffprobe -show_entries format=duration`. */
  durationSeconds: number;
};

const CLIPS: readonly SeedClip[] = [
  {
    slug: "clip-01-bars",
    title: "Color bars",
    description: "SMPTE test slika — staticni kadar, referenca za boje.",
    durationSeconds: 24,
  },
  {
    slug: "clip-02-motion",
    title: "Motion test",
    description: "Pokretni uzorak — pokazuje kako enkoder barata kretanjem.",
    durationSeconds: 28,
  },
  {
    slug: "clip-03-fractal",
    title: "Fractal zoom",
    description: "Mandelbrot zum — postepena promena, blag pritisak na bitrate.",
    durationSeconds: 20,
  },
  {
    slug: "clip-04-noise",
    title: "Cellular noise",
    description: "Conwayev zivot — visoka entropija, najgori slucaj za kompresiju.",
    durationSeconds: 26,
  },
];

/**
 * Pravi poglavlja na granicama HLS segmenata (0s, 6s, 12s...).
 *
 * Granica segmenta je i keyframe, pa skok na poglavlje ne trazi dekodiranje
 * unazad — plejer krece tacno od te tacke.
 */
function buildChapters(durationSeconds: number) {
  const chapters: { title: string; startSeconds: number; order: number }[] = [];

  for (let start = 0, order = 0; start < durationSeconds; start += SEGMENT_SECONDS, order += 1) {
    chapters.push({
      title: `Segment ${order + 1}`,
      startSeconds: start,
      order,
    });
  }

  return chapters;
}

async function main() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("Nedostaje DATABASE_URL — kopiraj .env.example u .env.local.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const clip of CLIPS) {
      const chapters = buildChapters(clip.durationSeconds);

      const video = await prisma.video.upsert({
        where: { slug: clip.slug },
        create: {
          slug: clip.slug,
          title: clip.title,
          description: clip.description,
          durationSeconds: clip.durationSeconds,
          manifestPath: `hls/${clip.slug}/master.m3u8`,
          posterPath: `hls/${clip.slug}/poster.jpg`,
          published: true,
        },
        update: {
          title: clip.title,
          description: clip.description,
          durationSeconds: clip.durationSeconds,
          manifestPath: `hls/${clip.slug}/master.m3u8`,
          posterPath: `hls/${clip.slug}/poster.jpg`,
          published: true,
        },
      });

      // Obrisi pa upisi — jednostavnije i pouzdanije nego uparivanje po redu,
      // a poglavlja su izvedena iz trajanja pa nema podataka koje bi izgubio.
      await prisma.chapter.deleteMany({ where: { videoId: video.id } });
      await prisma.chapter.createMany({
        data: chapters.map((chapter) => ({ ...chapter, videoId: video.id })),
      });

      console.log(
        `  ${clip.slug.padEnd(18)} ${clip.durationSeconds}s, ${chapters.length} poglavlja`,
      );
    }

    const videos = await prisma.video.count();
    const chapters = await prisma.chapter.count();
    console.log(`\ngotovo: ${videos} videa, ${chapters} poglavlja`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
