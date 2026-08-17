import { z } from "zod";

/**
 * Validacija ulaza za API rute.
 *
 * Sve sto stigne sa mreze je nepoverljivo — query parametri, putanje, telo.
 * Ove seme su granica: iza njih kod radi sa proverenim, tipiziranim vrednostima.
 */

/** Podrazumevana velicina stranice kad klijent ne trazi drugacije. */
export const DEFAULT_PAGE_SIZE = 12;

/** Gornja granica — bez nje bi `?pageSize=100000` povukao ceo katalog. */
export const MAX_PAGE_SIZE = 50;

/**
 * `GET /api/videos?page=&pageSize=`
 *
 * `coerce` je nuzan: query parametri su uvek stringovi, a nama trebaju brojevi.
 */
export const listVideosQuerySchema = z.object({
  page: z.coerce
    .number({ message: "page mora biti broj" })
    .int({ message: "page mora biti ceo broj" })
    .min(1, { message: "page mora biti 1 ili veci" })
    .default(1),
  pageSize: z.coerce
    .number({ message: "pageSize mora biti broj" })
    .int({ message: "pageSize mora biti ceo broj" })
    .min(1, { message: "pageSize mora biti 1 ili veci" })
    .max(MAX_PAGE_SIZE, { message: `pageSize ne sme biti veci od ${MAX_PAGE_SIZE}` })
    .default(DEFAULT_PAGE_SIZE),
});

export type ListVideosQuery = z.infer<typeof listVideosQuerySchema>;

/**
 * `GET /api/videos/[idOrSlug]`
 *
 * Isti parametar prima i cuid i slug. Regex propusta samo znakove koji se u
 * oba pojavljuju, pa ocigledno smece pada na 400 umesto da ide do baze.
 */
export const videoParamSchema = z.object({
  idOrSlug: z
    .string()
    .trim()
    .min(1, { message: "idOrSlug ne sme biti prazan" })
    .max(200, { message: "idOrSlug je predugacak" })
    .regex(/^[A-Za-z0-9_-]+$/, {
      message: "idOrSlug sme da sadrzi samo slova, cifre, - i _",
    }),
});

export type VideoParam = z.infer<typeof videoParamSchema>;
