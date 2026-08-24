import { notFound } from "next/navigation";

import { ChapterEditor } from "@/components/admin/chapter-editor";
import { VideoForm } from "@/components/admin/video-form";
import { deleteVideoAction, updateVideoAction } from "@/server/actions/admin-videos";
import { getVideoForEdit } from "@/server/admin/videos";

export const dynamic = "force-dynamic";

export default async function EditVideoPage({ params }: PageProps<"/admin/videos/[id]/edit">) {
  const { id } = await params;
  const video = await getVideoForEdit(id);
  if (!video) notFound();

  // Bind-ovan server action — `updateVideoAction(videoId, prevState, formData)`
  // postaje oblik `(prevState, formData)` koji `useActionState` ocekuje.
  const boundUpdate = updateVideoAction.bind(null, video.id);
  const boundDelete = deleteVideoAction.bind(null, video.id);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-6 text-[22px] font-semibold tracking-[-0.02em]">Izmeni: {video.title}</h1>
        <VideoForm
          action={boundUpdate}
          submitLabel="Sačuvaj izmene"
          initial={{
            slug: video.slug,
            title: video.title,
            description: video.description,
            durationSeconds: video.durationSeconds,
            posterPath: video.posterPath,
            manifestPath: video.manifestPath,
          }}
        />
      </div>

      <div>
        <h2 className="mb-4 text-[16px] font-semibold tracking-[-0.01em]">Poglavlja</h2>
        <ChapterEditor
          videoId={video.id}
          durationSeconds={video.durationSeconds}
          initialChapters={video.chapters}
        />
      </div>

      <div className="border-kf-line border-t pt-6">
        <form action={boundDelete}>
          <button
            type="submit"
            className="border-kf-danger text-kf-danger hover:bg-kf-danger-soft rounded-kf-btn kf-focus-ring cursor-pointer border px-3.5 py-2 text-[13px] font-medium transition-colors"
          >
            Obriši snimak
          </button>
        </form>
      </div>
    </div>
  );
}
