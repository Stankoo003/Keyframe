/**
 * Klipovi dostupni u aplikaciji.
 *
 * Ovde stoje samo identifikatori — nijedan URL. Putanje se grade kroz
 * `mediaUrl()` iz src/lib/media.ts, da bi lokalno i deploy-ovano okruzenje
 * mogli da gadjaju razlicite izvore bez izmene u kodu.
 *
 * Kad dodje baza, ovo prelazi u Prisma model.
 */

export type Clip = {
  /** Slug — poklapa se sa imenom foldera u media/hls/. */
  slug: string;
  title: string;
  durationSeconds: number;
};

export const CLIPS: readonly Clip[] = [
  { slug: "clip-01-bars", title: "Color bars", durationSeconds: 24 },
  { slug: "clip-02-motion", title: "Motion test", durationSeconds: 28 },
  { slug: "clip-03-fractal", title: "Fractal zoom", durationSeconds: 20 },
  { slug: "clip-04-noise", title: "Cellular noise", durationSeconds: 26 },
] as const;
