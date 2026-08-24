"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import type { ActionFormState } from "@/lib/admin/schemas";
import { videoMetadataSchema } from "@/lib/admin/schemas";
import { requireAdminSession } from "@/server/actions/admin-auth";
import * as adminVideos from "@/server/admin/videos";

type MetadataField = "slug" | "title" | "description" | "durationSeconds" | "posterPath" | "manifestPath";
export type VideoFormState = ActionFormState<MetadataField>;

function parseMetadata(formData: FormData): { ok: true; data: ReturnType<typeof videoMetadataSchema.parse> } | { ok: false; state: VideoFormState } {
  const result = videoMetadataSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description"),
    durationSeconds: formData.get("durationSeconds"),
    posterPath: formData.get("posterPath"),
    manifestPath: formData.get("manifestPath"),
  });

  if (!result.success) {
    const flat = result.error.flatten();
    return {
      ok: false,
      state: {
        formError: "Ispravi greške ispod pre čuvanja.",
        fieldErrors: flat.fieldErrors as VideoFormState["fieldErrors"],
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Prisma greske nose ceo upit u `.message` (fajl putanje, SQL kontekst) — NIKAD
 * se ne sme proslediti direktno u `formError`, koji ide pravo na admin ekran.
 * Prepoznata greska dobija jasnu poruku; sve ostalo generican tekst.
 */
function toFormError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Slug već postoji — izaberi drugi.";
  }
  return "Snimak nije sačuvan. Pokušaj ponovo.";
}

export async function createVideoAction(
  _prevState: VideoFormState,
  formData: FormData,
): Promise<VideoFormState> {
  await requireAdminSession();

  const parsed = parseMetadata(formData);
  if (!parsed.ok) return parsed.state;

  let created: { id: string };
  try {
    created = await adminVideos.createVideo(parsed.data);
  } catch (error: unknown) {
    // Najcesci uzrok: slug vec postoji (`@unique` u schema.prisma).
    return { formError: toFormError(error) };
  }

  revalidatePath("/admin");
  redirect(`/admin/videos/${created.id}/edit`);
}

export async function updateVideoAction(
  videoId: string,
  _prevState: VideoFormState,
  formData: FormData,
): Promise<VideoFormState> {
  await requireAdminSession();

  const parsed = parseMetadata(formData);
  if (!parsed.ok) return parsed.state;

  try {
    await adminVideos.updateVideoMetadata(videoId, parsed.data);
  } catch (error: unknown) {
    return { formError: toFormError(error) };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/videos/${videoId}/edit`);
  revalidatePath(`/videos/${parsed.data.slug}`);
  revalidatePath("/");

  return { formError: undefined };
}

export async function deleteVideoAction(videoId: string): Promise<void> {
  await requireAdminSession();
  await adminVideos.deleteVideo(videoId);
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

/**
 * Obican `<form action={...}>` (bez `useActionState`) — radi i bez JS-a
 * (progressive enhancement). `revalidatePath` mora da pogodi i javnu listu i
 * detalj stranicu, jer publish/unpublish odmah menja sta je tamo vidljivo.
 */
export async function togglePublishAction(formData: FormData): Promise<void> {
  await requireAdminSession();

  const videoId = String(formData.get("videoId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const nextPublished = formData.get("nextPublished") === "true";
  if (!videoId) return;

  await adminVideos.setPublished(videoId, nextPublished);

  revalidatePath("/admin");
  revalidatePath("/");
  if (slug) revalidatePath(`/videos/${slug}`);
}
