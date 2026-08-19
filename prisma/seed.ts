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

type SeedChapter = {
  title: string;
  /** MORA biti umnozak SEGMENT_SECONDS — vidi `assertAligned`. */
  startSeconds: number;
};

type SeedSubtitle = {
  /** BCP-47 oznaka jezika — ide pravo u <track srclang>. */
  lang: string;
  /** Ime na JEZIKU TITLA ("English", ne "Engleski"). */
  label: string;
  /** Samo ime fajla; putanja se sklapa kao "captions/<file>". */
  file: string;
};

type SeedClip = {
  slug: string;
  title: string;
  description: string;
  /** Izmereno sa `ffprobe -show_entries format=duration`. */
  durationSeconds: number;
  chapters: readonly SeedChapter[];
  /**
   * Podrazumevano true. Jedan zapis je namerno false — sluzi kao fixture da se
   * moze proveriti da javna lista i detalj endpoint zaista preskacu nacrte,
   * bez rucnog diranja baze.
   */
  published?: boolean;
  /** Folder sa media fajlovima; podrazumevano isti kao slug. */
  mediaSlug?: string;
  /**
   * Titlovi. Podrazumevano ih NEMA, i to je namerno: sinteticki klipovi ispod
   * su ffmpeg test-sare sa sinusnim tonom, u njima nema govora koji bi se
   * titlovao. Prazna lista je fixture za drugu stranu funkcionalnosti —
   * plejer po njoj onemogucuje CC kontrolu umesto da nudi toggle koji ne radi.
   */
  subtitles?: readonly SeedSubtitle[];
};

const CLIPS: readonly SeedClip[] = [
  {
    slug: "clip-01-bars",
    title: "Color bars",
    description: "SMPTE test slika — staticni kadar, referenca za boje.",
    durationSeconds: 24,
    chapters: [
      { title: "Osnovne boje", startSeconds: 0 },
      { title: "Sivi stepenik", startSeconds: 6 },
      { title: "Crna referenca", startSeconds: 12 },
      { title: "Odjava", startSeconds: 18 },
    ],
  },
  {
    slug: "clip-02-motion",
    title: "Motion test",
    description: "Pokretni uzorak — pokazuje kako enkoder barata kretanjem.",
    durationSeconds: 28,
    chapters: [
      { title: "Mirna slika", startSeconds: 0 },
      { title: "Sporo kretanje", startSeconds: 6 },
      { title: "Brzo kretanje", startSeconds: 12 },
      { title: "Nagla promena scene", startSeconds: 18 },
      { title: "Smirivanje", startSeconds: 24 },
    ],
  },
  {
    slug: "clip-03-fractal",
    title: "Fractal zoom",
    description: "Mandelbrot zum — postepena promena, blag pritisak na bitrate.",
    durationSeconds: 20,
    // Jedini klip sa SRT titlom — fixture za konverziju SRT -> WebVTT.
    subtitles: [{ lang: "sr", label: "Srpski", file: "clip-03-fractal.sr.srt" }],
    chapters: [
      { title: "Ceo skup", startSeconds: 0 },
      { title: "Ulazak u rub", startSeconds: 6 },
      { title: "Dubinski zum", startSeconds: 12 },
      { title: "Najsitniji detalj", startSeconds: 18 },
    ],
  },
  {
    slug: "clip-04-noise",
    title: "Cellular noise",
    description: "Conwayev zivot — visoka entropija, najgori slucaj za kompresiju.",
    durationSeconds: 26,
    chapters: [
      { title: "Pocetna populacija", startSeconds: 0 },
      { title: "Sirenje", startSeconds: 6 },
      { title: "Stabilni oblici", startSeconds: 12 },
      { title: "Gasenje", startSeconds: 18 },
    ],
  },
  {
    slug: "solar-eclipse",
    title: "Longest solar eclipse",
    description:
      "Snimak pomracenja Sunca — pravi materijal, 1080p na 29.97 fps. Jedini klip duzi od minuta.",
    durationSeconds: 510,
    chapters: [
      { title: "Poletanje", startSeconds: 0 },
      { title: "Presretanje senke", startSeconds: 90 },
      { title: "Prvi kontakt", startSeconds: 186 },
      { title: "Potpuna faza", startSeconds: 288 },
      { title: "Izlazak iz senke", startSeconds: 390 },
      { title: "Povratak", startSeconds: 462 },
    ],
    // Jedini klip sa pravim govorom, pa jedini koji ima titlove.
    subtitles: [{ lang: "en", label: "English", file: "solar-eclipse.en.vtt" }],
  },
  {
    slug: "clip-01-bars-draft",
    title: "Color bars (nacrt)",
    description: "Neobjavljen zapis — ne sme se pojaviti u javnoj listi ni na detalju.",
    durationSeconds: 24,
    published: false,
    // Pokazuje na postojece fajlove; ne pravi se nova media za fixture.
    mediaSlug: "clip-01-bars",
    chapters: [
      { title: "Osnovne boje", startSeconds: 0 },
      { title: "Odjava", startSeconds: 18 },
    ],
  },
];

/**
 * Proverava poglavlja jednog klipa i dodaje `order`.
 *
 * PORAVNANJE JE OBAVEZNO. Enkoder iz `scripts/encode.sh` sece segmente na
 * svakih SEGMENT_SECONDS i tera keyframe na svakoj granici (`-g`, `-keyint_min`,
 * `-sc_threshold 0`). Poglavlje koje pocinje na granici segmenta pocinje i na
 * keyframe-u, pa plejer krece tacno od te slike — bez dekodiranja unazad i bez
 * vidljivog "kasnjenja" posle skoka.
 *
 * Zato ovo puca umesto da tiho prihvati neporavnat broj: greska u podacima se
 * inace vidi tek kao cudno ponasanje plejera, sto je mnogo skuplje za nalazenje.
 */
function prepareChapters(clip: SeedClip) {
  return clip.chapters.map((chapter, order) => {
    if (chapter.startSeconds % SEGMENT_SECONDS !== 0) {
      throw new Error(
        `${clip.slug}: poglavlje "${chapter.title}" pocinje na ${chapter.startSeconds}s, ` +
          `sto nije umnozak ${SEGMENT_SECONDS}s (granica segmenta i keyframe).`,
      );
    }

    if (chapter.startSeconds >= clip.durationSeconds) {
      throw new Error(
        `${clip.slug}: poglavlje "${chapter.title}" pocinje na ${chapter.startSeconds}s, ` +
          `a snimak traje ${clip.durationSeconds}s.`,
      );
    }

    return { title: chapter.title, startSeconds: chapter.startSeconds, order };
  });
}

/**
 * Proverava titlove jednog klipa i sklapa relativnu putanju.
 *
 * Dozvoljena su oba formata: SRT plejer pretvara u WebVTT u browseru, vidi
 * `src/components/player/subtitle-source.ts`. Ekstenzija ovde je samo gruba
 * provera — pravi format se u plejeru cita iz sadrzaja fajla.
 *
 * Puca iz istog razloga kao `prepareChapters`: pogresna putanja do titl fajla
 * ne obara ni seed ni stranicu — plejer samo tiho ne prikaze titlove, sto se
 * lovi mnogo duze nego greska ovde.
 */
function prepareSubtitles(clip: SeedClip) {
  const subtitles = clip.subtitles ?? [];
  const seen = new Set<string>();

  return subtitles.map((subtitle) => {
    if (!/\.(vtt|srt)$/.test(subtitle.file)) {
      throw new Error(`${clip.slug}: titl "${subtitle.file}" nije .vtt ni .srt fajl.`);
    }

    if (subtitle.file.includes("/")) {
      throw new Error(
        `${clip.slug}: titl "${subtitle.file}" sadrzi kosu crtu — ocekuje se samo ime fajla.`,
      );
    }

    if (seen.has(subtitle.lang)) {
      throw new Error(`${clip.slug}: dva titla za isti jezik "${subtitle.lang}".`);
    }
    seen.add(subtitle.lang);

    return {
      lang: subtitle.lang,
      label: subtitle.label,
      path: `captions/${subtitle.file}`,
      isDefault: false,
    };
  });
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
      const chapters = prepareChapters(clip);
      const subtitles = prepareSubtitles(clip);
      const mediaSlug = clip.mediaSlug ?? clip.slug;
      const published = clip.published ?? true;

      const fields = {
        title: clip.title,
        description: clip.description,
        durationSeconds: clip.durationSeconds,
        manifestPath: `hls/${mediaSlug}/master.m3u8`,
        posterPath: `hls/${mediaSlug}/poster.jpg`,
        published,
      };

      const video = await prisma.video.upsert({
        where: { slug: clip.slug },
        create: { slug: clip.slug, ...fields },
        update: fields,
      });

      // Obrisi pa upisi — jednostavnije i pouzdanije nego uparivanje po redu,
      // a poglavlja su izvedena iz trajanja pa nema podataka koje bi izgubio.
      await prisma.chapter.deleteMany({ where: { videoId: video.id } });
      await prisma.chapter.createMany({
        data: chapters.map((chapter) => ({ ...chapter, videoId: video.id })),
      });

      // deleteMany ide BEZUSLOVNO, i kad klip nema titlove — inace uklanjanje
      // titla iz CLIPS ne bi obrisalo red pri ponovnom seed-u.
      await prisma.subtitle.deleteMany({ where: { videoId: video.id } });
      if (subtitles.length > 0) {
        await prisma.subtitle.createMany({
          data: subtitles.map((subtitle) => ({ ...subtitle, videoId: video.id })),
        });
      }

      console.log(
        `  ${clip.slug.padEnd(20)} ${clip.durationSeconds}s, ${chapters.length} poglavlja` +
          (subtitles.length > 0 ? `, ${subtitles.length} titl` : "") +
          (published ? "" : "  [nacrt]"),
      );
    }

    const videos = await prisma.video.count();
    const publishedCount = await prisma.video.count({ where: { published: true } });
    const chapters = await prisma.chapter.count();
    const subtitles = await prisma.subtitle.count();
    console.log(
      `\ngotovo: ${videos} videa (${publishedCount} objavljeno), ` +
        `${chapters} poglavlja, ${subtitles} titl`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
