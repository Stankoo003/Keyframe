import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import { VideoTable } from "@/components/admin/video-table";
import { listAllVideos } from "@/server/admin/videos";

/** Lista SVIH snimaka (uklj. nacrte) — javna `/` lista vidi samo objavljene. */
export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const videos = await listAllVideos();

  const published = videos.filter((video) => video.published).length;
  const chapters = videos.reduce((sum, video) => sum + video.chapterCount, 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Snimci</h1>
          <p className="text-kf-mut mt-1.5 text-[14px]">
            {videos.length} ukupno · {published} objavljeno · {videos.length - published} u nacrtu
          </p>
        </div>
        <Link
          href="/admin/videos/new"
          className="bg-kf-ink text-kf-accent-ink rounded-kf-btn kf-focus-ring px-5 py-2.75 text-[13px] font-semibold transition-colors hover:bg-white"
        >
          + Novi snimak
        </Link>
      </div>

      {videos.length === 0 ? (
        <p className="text-kf-mut mt-7 text-[13px]">Nema snimaka.</p>
      ) : (
        <>
          <div className="mt-6.5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
            <StatCard label="Snimci" value={String(videos.length)} sub="ukupno u bazi" />
            <StatCard
              label="Objavljeno"
              value={String(published)}
              sub={`${videos.length - published} nije objavljeno`}
            />
            <StatCard label="Poglavlja" value={String(chapters)} sub="kroz sve snimke" />
          </div>

          <div className="mt-5.5">
            <VideoTable videos={videos} />
          </div>
        </>
      )}
    </div>
  );
}
