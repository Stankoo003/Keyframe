import { notFound } from "next/navigation";

import { ChapterEditor } from "@/components/admin/chapter-editor";
import { VideoForm } from "@/components/admin/video-form";
import { deleteVideoAction, updateVideoAction } from "@/server/actions/admin-videos";
import { getVideoForEdit } from "@/server/admin/videos";

export const dynamic = "force-dynamic";

const CARD = "border-kf-line bg-kf-surface rounded-kf-card border p-5.5";

export default async function EditVideoPage({ params }: PageProps<"/admin/videos/[id]/edit">) {
  const { id } = await params;
  const video = await getVideoForEdit(id);
  if (!video) notFound();

  // Bind-ovan server action — `updateVideoAction(videoId, prevState, formData)`
  // postaje oblik `(prevState, formData)` koji `useActionState` ocekuje.
  const boundUpdate = updateVideoAction.bind(null, video.id);
  const boundDelete = deleteVideoAction.bind(null, video.id);

  return (
    <div className="max-w-240">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="kf-micro">Izmena snimka</div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">{video.title}</h1>
          <p className="text-kf-mut2 mt-1.5 font-mono text-[11px]">
            {video.slug} · {video.durationSeconds}s
          </p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 font-mono text-[10px] tracking-[0.1em] uppercase ${
            video.published
              ? "border-kf-accent-line bg-kf-accent-soft text-kf-accent"
              : "border-kf-line bg-kf-fill text-kf-ink2"
          }`}
        >
          {video.published ? "Objavljeno" : "Nacrt"}
        </span>
      </div>

      <div className="mt-6.5 flex flex-col gap-4.5">
        <div className={CARD}>
          <div className="kf-micro mb-4.5">Metapodaci</div>
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

        <div className={CARD}>
          <h2 className="kf-micro mb-4.5">Poglavlja</h2>
          <ChapterEditor
            videoId={video.id}
            durationSeconds={video.durationSeconds}
            initialChapters={video.chapters}
          />
        </div>

        <div className="border-kf-danger/35 rounded-kf-card flex flex-wrap items-center justify-between gap-4 border p-5.5">
          <div>
            <div className="kf-micro">Opasna zona</div>
            <p className="text-kf-mut mt-2 text-[13px]">
              Brisanje uklanja i sva poglavlja snimka. Nema povratka.
            </p>
          </div>
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
    </div>
  );
}
