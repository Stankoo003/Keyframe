/**
 * Oblici koje API vraca — ugovor prema klijentima.
 *
 * Namerno odvojeni od Prisma tipova. Prisma vrsta nosi i stvari koje spolja
 * nemaju sta da rade (`manifestPath`, `published`, `updatedAt`), a vezivanje
 * odgovora za oblik tabele znaci da svaka izmena seme lomi klijente.
 *
 * Cist domenski sloj: bez I/O, bez zavisnosti na Prismu ili Next.
 */

export type ChapterDto = {
  id: string;
  title: string;
  /** Pocetak poglavlja u celim sekundama od pocetka videa. */
  startSeconds: number;
  /** Redosled prikaza, 0-bazno. */
  order: number;
};

export type SubtitleDto = {
  id: string;
  /** BCP-47 oznaka jezika — ide pravo u <track srclang>. */
  lang: string;
  /** Ime na jeziku titla, za nativni meni ("English"). */
  label: string;
  /** Pun URL do .vtt fajla — relativna putanja iz baze + base URL iz env configa. */
  url: string;
  isDefault: boolean;
};

/** Video u listi — bez poglavlja, da odgovor ne raste sa katalogom. */
export type VideoListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  /** Trajanje u celim sekundama. */
  durationSeconds: number;
  /** Pun URL — relativna putanja iz baze + base URL iz env configa. */
  manifestUrl: string;
  posterUrl: string | null;
  chapterCount: number;
};

/** Video sa punim poglavljima i titlovima — vraca ga samo detalj endpoint. */
export type VideoDetail = VideoListItem & {
  chapters: ChapterDto[];
  /** Prazno kad snimak nema titlove — plejer po tome onemogucuje CC kontrolu. */
  subtitles: SubtitleDto[];
};

export type PageMeta = {
  /** 1-bazno. */
  page: number;
  pageSize: number;
  /** Ukupan broj objavljenih videa, ne samo na ovoj stranici. */
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type Paginated<T> = {
  data: T[];
  meta: PageMeta;
};

export type ApiErrorCode = "VALIDATION_ERROR" | "NOT_FOUND";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Popunjeno samo kod validacije — koje polje i sta ne valja. */
    details?: { path: string; message: string }[];
  };
};
