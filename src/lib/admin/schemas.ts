import { z } from "zod";

/**
 * Validacija za admin forme — isti stil kao `src/lib/api/schemas.ts` (srpske
 * poruke, `z.coerce` za brojeve iz form-data-e, koja je uvek string).
 */

/** Isti regex kao `videoParamSchema` — slug mora biti citljiv id, ne slobodan tekst. */
const SLUG_REGEX = /^[A-Za-z0-9_-]+$/;

export const videoMetadataSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug je obavezan")
    .max(200, "Slug je predugačak")
    .regex(SLUG_REGEX, "Slug sme da sadrži samo slova, cifre, - i _"),
  title: z.string().trim().min(1, "Naslov je obavezan").max(200, "Naslov je predugačak"),
  description: z
    .string()
    .trim()
    .max(2000, "Opis je predugačak")
    .optional()
    .transform((value) => (value ? value : null)),
  durationSeconds: z.coerce
    .number({ message: "Trajanje mora biti broj" })
    .int("Trajanje mora biti ceo broj sekundi")
    .positive("Trajanje mora biti veće od 0"),
  // Relativne putanje, isto pravilo kao baza (vidi schema.prisma) — bez hosta,
  // bez vodece kose crte.
  posterPath: z
    .string()
    .trim()
    .max(500, "Putanja je predugačka")
    .refine((value) => !value || (!value.startsWith("/") && !/^[a-z]+:\/\//i.test(value)), {
      message: "Putanja mora biti relativna (bez / ili http:// na početku)",
    })
    .optional()
    .transform((value) => (value ? value : null)),
  manifestPath: z
    .string()
    .trim()
    .min(1, "Putanja do manifesta je obavezna")
    .max(500, "Putanja je predugačka")
    .refine((value) => !value.startsWith("/") && !/^[a-z]+:\/\//i.test(value), {
      message: "Putanja mora biti relativna (bez / ili http:// na početku)",
    }),
});

export type VideoMetadataFormValues = z.infer<typeof videoMetadataSchema>;

/**
 * Granica poglavlja zavisi od KONKRETNOG snimka — zato je fabrika, ne
 * staticka sema. `durationSeconds` dolazi iz vec sacuvanih metapodataka
 * (vidi napomenu u planu: menjas trajanje → prvo sacuvaj metapodatke, pa tek
 * onda poglavlja protiv novog trajanja).
 */
export function chapterSchema(durationSeconds: number) {
  return z.object({
    title: z.string().trim().min(1, "Naslov poglavlja je obavezan").max(200, "Naslov je predugačak"),
    startSeconds: z.coerce
      .number({ message: "Vreme mora biti broj" })
      .int("Vreme mora biti ceo broj sekundi")
      .min(0, "Vreme ne sme biti negativno")
      .max(
        durationSeconds - 1,
        `Mora početi pre kraja snimka (snimak traje ${durationSeconds}s)`,
      ),
  });
}

export function chapterListSchema(durationSeconds: number) {
  return z
    .array(chapterSchema(durationSeconds))
    .min(0)
    .superRefine((chapters, ctx) => {
      // Poglavlja van hronoloskog reda bi bila zbunjujuca — plejer ih vec
      // crta na traci u redosledu u kom stoje.
      for (let i = 1; i < chapters.length; i += 1) {
        const previous = chapters[i - 1]!;
        const current = chapters[i]!;
        if (current.startSeconds < previous.startSeconds) {
          ctx.addIssue({
            code: "custom",
            path: [i, "startSeconds"],
            message: `"${current.title}" počinje pre prethodnog poglavlja — poglavlja moraju biti hronološki`,
          });
        }
      }
    });
}

/** Zajednicki oblik greske za sve admin `useActionState` forme. */
export type ActionFormState<TFields extends string = string> = {
  fieldErrors?: Partial<Record<TFields, string[]>>;
  formError?: string;
};
