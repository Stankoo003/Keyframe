/**
 * Admin DTO oblici — namerno odvojeni od `src/domain/video.ts`.
 *
 * Javni DTO-ovi (`VideoListItem`, `VideoDetail`) izostavljaju `manifestPath`,
 * `published`, `updatedAt` — tacno ono sto admin panel MORA da vidi i menja.
 * Vezivanje admin ekrana za javne tipove bi ih ili osiromasilo, ili prosirilo
 * javni ugovor poljima koja spoljni potrosaci ne smeju da vide.
 */

export type AdminChapterDto = {
  id: string;
  title: string;
  startSeconds: number;
  order: number;
};

/** Red u admin listi svih snimaka (objavljenih i nacrta). */
export type AdminVideoListItem = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  durationSeconds: number;
  chapterCount: number;
};

/** Pun snimak za formu izmene — sirove (relativne) putanje, ne `mediaUrl()`. */
export type AdminVideoDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationSeconds: number;
  posterPath: string | null;
  manifestPath: string;
  published: boolean;
  chapters: AdminChapterDto[];
};

/** Ulaz za kreiranje/izmenu metapodataka — bez `id`/`chapters`. */
export type VideoMetadataInput = {
  slug: string;
  title: string;
  description: string | null;
  durationSeconds: number;
  posterPath: string | null;
  manifestPath: string;
};

/** Ulaz za jedno poglavlje pri cuvanju cele liste (bez `id`/`order` — dodeljuju se pri upisu). */
export type ChapterInput = {
  title: string;
  startSeconds: number;
};
