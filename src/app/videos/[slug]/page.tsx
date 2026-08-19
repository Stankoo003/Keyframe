import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { PlayerStage } from "@/components/player/player-stage";
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

  const chapterLabel = video.chapterCount === 1 ? "poglavlje" : "poglavlja";

  return (
    <>
      <SiteHeader showBack meta={`${video.slug} · ${video.chapterCount} ${chapterLabel}`} />

      <PageShell className="pt-7 pb-18">
        <div className="mx-auto max-w-275">
          <div className="min-w-0">
            {/*
             * Blok naslova ide kao `children` kroz `PlayerStage`: on je klijentska
             * komponenta jer deli stanje plejera sa poglavljima, ali naslov i opis
             * ostaju SERVER-renderovani i samo prolaze kroz njega.
             */}
            <PlayerStage
              videoId={video.id}
              src={video.manifestUrl}
              title={video.title}
              poster={video.posterUrl}
              chapters={video.chapters}
              durationSeconds={video.durationSeconds}
              subtitles={video.subtitles}
            >
              <div className="mt-6.5 max-w-[66ch]">
                <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[34px]">
                  {video.title}
                </h1>

                {/* Mono meta red iz dizajna — samo podaci koje baza zaista ima. */}
                <div className="kf-micro mt-2.5 flex flex-wrap gap-3.5 tracking-[0.1em]">
                  <span>HLS</span>
                  <span>{formatTime(video.durationSeconds)}</span>
                  <span>
                    {video.chapterCount} {chapterLabel}
                  </span>
                </div>

                {video.description && (
                  <p className="text-kf-ink2 mt-4 text-[15px] leading-[1.65] text-pretty">
                    {video.description}
                  </p>
                )}
              </div>
            </PlayerStage>
          </div>
        </div>
      </PageShell>
    </>
  );
}
