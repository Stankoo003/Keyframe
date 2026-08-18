import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChapterList } from "@/components/chapter-list";
import { HlsPlayer } from "@/components/player/hls-player";
import { SiteHeader } from "@/components/site-header";
import { formatTime } from "@/lib/format";
import { getPublishedVideoByIdOrSlug } from "@/server/videos";

/**
 * Detalj jednog snimka.
 *
 * Neobjavljen ili nepostojeci slug ide na `notFound()` → `not-found.tsx`.
 * Po odgovoru se ta dva slucaja ne razlikuju, pa se postojanje nacrta ne otkriva.
 *
 * SOFT 404: `loading.tsx` pravi Suspense granicu, pa Next posalje ljusku sa
 * statusom 200 pre nego sto se stigne do `notFound()` — a status se ne moze
 * promeniti kad je slanje poceo. To je dokumentovano ponasanje App Routera:
 * "200 for streamed responses, 404 for non-streamed".
 *
 * Zadatak trazi vidljivo loading stanje, pa `loading.tsx` ostaje, a soft 404 se
 * resava kako dokumentacija propisuje — `noindex`, da stranica ne zavrsi u
 * pretrazivacima. Masinski potrosaci ionako idu na `/api/videos/[idOrSlug]`,
 * koji vraca pravi 404.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/videos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const video = await getPublishedVideoByIdOrSlug(slug);

  // `noindex` ne postavljamo rucno — Next ga sam dodaje kad se pozove
  // `notFound()`, pa bi rucni tag bio duplikat.
  if (!video) return { title: "Snimak nije pronađen · Keyframe" };

  return {
    title: `${video.title} · Keyframe`,
    description: video.description ?? undefined,
  };
}

export default async function VideoDetailPage({ params }: PageProps<"/videos/[slug]">) {
  const { slug } = await params;
  const video = await getPublishedVideoByIdOrSlug(slug);

  if (!video) notFound();

  return (
    <>
      <SiteHeader showBack />

      <main className="grid grid-cols-1 items-start gap-6 px-4 pt-5 pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7.5 lg:px-5 lg:pt-6.5 lg:pb-12">
        <div className="flex min-w-0 flex-col gap-5">
          <HlsPlayer src={video.manifestUrl} title={video.title} poster={video.posterUrl} />

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="border-kf-blue-line bg-kf-blue-soft text-kf-blue rounded-[5px] border px-2 py-[3px] font-mono text-[10.5px] leading-[1.5] font-medium">
                HLS
              </span>
              <span className="text-kf-mut font-mono text-[11.5px]">
                {formatTime(video.durationSeconds)} · {video.chapterCount}{" "}
                {video.chapterCount === 1 ? "poglavlje" : "poglavlja"}
              </span>
            </div>

            <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em]">
              {video.title}
            </h1>

            {video.description && (
              <p className="text-kf-ink2 max-w-[62ch] text-[14.5px] leading-[1.65] text-pretty">
                {video.description}
              </p>
            )}
          </div>
        </div>

        <ChapterList chapters={video.chapters} durationSeconds={video.durationSeconds} />
      </main>
    </>
  );
}
