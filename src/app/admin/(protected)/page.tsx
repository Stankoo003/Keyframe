import Link from "next/link";

import { togglePublishAction } from "@/server/actions/admin-videos";
import { listAllVideos } from "@/server/admin/videos";

/** Lista SVIH snimaka (uklj. nacrte) — javna `/` lista vidi samo objavljene. */
export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const videos = await listAllVideos();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Snimci</h1>
        <Link
          href="/admin/videos/new"
          className="bg-kf-ink text-kf-accent-ink rounded-kf-btn kf-focus-ring px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white"
        >
          + Novi snimak
        </Link>
      </div>

      {videos.length === 0 ? (
        <p className="text-kf-mut text-[13px]">Nema snimaka.</p>
      ) : (
        <ul className="border-kf-line divide-kf-line-soft divide-y rounded-kf-card border">
          {videos.map((video) => (
            <li key={video.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/videos/${video.id}/edit`}
                  className="hover:text-kf-accent kf-focus-ring rounded-sm text-[14px] font-medium"
                >
                  {video.title}
                </Link>
                <p className="text-kf-mut2 mt-0.5 font-mono text-[11px]">
                  {video.slug} · {video.durationSeconds}s ·{" "}
                  {video.chapterCount === 0 ? "bez poglavlja" : `${video.chapterCount} poglavlja`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <form action={togglePublishAction}>
                  <input type="hidden" name="videoId" value={video.id} />
                  <input type="hidden" name="slug" value={video.slug} />
                  <input type="hidden" name="nextPublished" value={String(!video.published)} />
                  <button
                    type="submit"
                    aria-pressed={video.published}
                    className={`rounded-kf-btn kf-focus-ring cursor-pointer border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      video.published
                        ? "border-kf-accent-line bg-kf-accent-soft text-kf-accent"
                        : "border-kf-line text-kf-mut hover:bg-kf-fill"
                    }`}
                  >
                    {video.published ? "Objavljeno" : "Nacrt"}
                  </button>
                </form>

                <Link
                  href={`/admin/videos/${video.id}/edit`}
                  className="text-kf-mut hover:text-kf-accent kf-focus-ring rounded-sm text-[13px]"
                >
                  Izmeni
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
