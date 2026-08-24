"use server";

import { revalidatePath } from "next/cache";

import type { ChapterInput } from "@/domain/admin-video";
import { chapterListSchema } from "@/lib/admin/schemas";
import { requireAdminSession } from "@/server/actions/admin-auth";
import { getVideoForEdit, replaceChapters } from "@/server/admin/videos";

export type SaveChaptersState = {
  formError?: string;
  /** Indeksirano po poziciji u nizu poglavlja — `ChapterEditor` iscrtava po indeksu. */
  itemErrors?: Record<number, string[]>;
  savedAt?: number;
};

/**
 * Zameni CEO niz poglavlja jednog snimka.
 *
 * Nije `<form action>` jer je payload niz objekata, ne ravna FormData — poziva
 * se preko `useActionState`-ovog `formAction(payload)` direktno iz
 * `ChapterEditor`-a (React dozvoljava proizvoljan payload kad `formAction` NIJE
 * vezan za `<form action={...}>`, vidi poziv u `chapter-editor.tsx`).
 */
export async function saveChaptersAction(
  _prevState: SaveChaptersState,
  payload: { videoId: string; chapters: ChapterInput[] },
): Promise<SaveChaptersState> {
  await requireAdminSession();

  const video = await getVideoForEdit(payload.videoId);
  if (!video) return { formError: "Snimak nije pronađen." };

  const result = chapterListSchema(video.durationSeconds).safeParse(payload.chapters);
  if (!result.success) {
    const itemErrors: Record<number, string[]> = {};
    for (const issue of result.error.issues) {
      const index = issue.path[0];
      if (typeof index !== "number") continue;
      const field = issue.path[1] !== undefined ? `${String(issue.path[1])}: ` : "";
      (itemErrors[index] ??= []).push(`${field}${issue.message}`);
    }
    return { formError: "Ispravi greške ispod pre čuvanja.", itemErrors };
  }

  await replaceChapters(payload.videoId, result.data);

  revalidatePath(`/admin/videos/${payload.videoId}/edit`);
  revalidatePath(`/videos/${video.slug}`);

  return { savedAt: Date.now() };
}
