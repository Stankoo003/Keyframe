import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { VideoCard } from "@/components/video-card";
import type { VideoListItem } from "@/domain/video";
import { formatTime } from "@/lib/format";
import { listPublishedVideos } from "@/server/videos";

/**
 * Katalog — hero + mreza objavljenih snimaka.
 *
 * Serverska komponenta koja cita bazu direktno. Poziv sopstvenog API-ja preko
 * HTTP-a bio bi mrezni skok sa servera na samog sebe; `/api/videos` postoji za
 * spoljne potrosace i deli isti kod iz `src/server/videos.ts`.
 *
 * Greske se NE hvataju ovde — puštaju se do `error.tsx`, da otkaz baze bude
 * vidljiv umesto da se pretvori u praznu stranicu.
 *
 * Dizajn ima hero sa "Continue watching" i trakom napretka; napredak gledanja se
 * ne cuva nigde, pa hero prikazuje PRVI snimak iz liste pod poštenom oznakom
 * "Najnovije". Filter pilule i redovi po kategorijama iz dizajna izostaju iz
 * istog razloga — model nema kategorije.
 */
export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const { data: videos, meta } = await listPublishedVideos({
    page: 1,
    pageSize: 24,
  });

  const [featured, ...rest] = videos;

  return (
    <>
      <SiteHeader />

      <PageShell className="pt-7 pb-20">
        {videos.length === 0 ? (
          <EmptyCatalog />
        ) : (
          <>
            {featured && <Hero video={featured} />}

            <div className="mt-12 mb-4.5 flex items-baseline gap-3.5">
              <h2 className="text-[22px] leading-none font-semibold tracking-[-0.025em]">
                Svi snimci
              </h2>
              <span className="kf-micro">
                {meta.total} {meta.total === 1 ? "snimak" : "snimaka"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]">
              {rest.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </>
        )}
      </PageShell>
    </>
  );
}

/** Istaknut snimak — prugasta 16:9 povrsina sa tekstom preko donjeg gradijenta. */
function Hero({ video }: { video: VideoListItem }) {
  return (
    <section className="kf-frame border-kf-line rounded-kf-card relative flex min-h-[420px] flex-col justify-end overflow-hidden border lg:min-h-[520px]">
      {video.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="kf-micro absolute inset-x-0 top-5.5 text-center text-[#4b545c]">
          {video.slug}
        </span>
      )}

      {/*
       * Gradijent je jaci nego u dizajnu: dizajn pretpostavlja taman kadar, a
       * nasi posteri su i SMPTE test slika sa punom zasicenoscu. Sa vrednostima
       * iz dizajna mono labela preko svetlih traka nije citljiva.
       */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(8,9,11,.97)_0%,rgba(8,9,11,.82)_35%,rgba(8,9,11,.3)_70%,rgba(8,9,11,.05)_100%)]"
      />

      <div className="relative p-6 pt-10 md:p-11 md:pt-14">
        <div className="kf-micro text-kf-accent flex items-center gap-3">
          <span aria-hidden="true" className="bg-kf-accent kf-pulse size-1.5 rounded-full" />
          <span>Najnovije</span>
          <span className="text-kf-mut">· {formatTime(video.durationSeconds)}</span>
        </div>

        <h1 className="mt-4 max-w-[16ch] text-[34px] leading-[1.02] font-semibold tracking-[-0.035em] text-pretty md:text-[52px]">
          {video.title}
        </h1>

        {video.description && (
          <p className="text-kf-ink2 mt-3.5 max-w-[52ch] text-[15px] leading-[1.6] text-pretty">
            {video.description}
          </p>
        )}

        <Link
          href={`/videos/${video.slug}`}
          className="bg-kf-ink text-kf-accent-ink rounded-kf-btn kf-focus-ring mt-6.5 inline-flex items-center gap-2.5 px-6 py-3.25 text-sm font-semibold transition-[transform,background] duration-180 hover:bg-white motion-safe:hover:-translate-y-px"
        >
          <span
            aria-hidden="true"
            className="block h-0 w-0 border-y-5 border-l-8 border-y-transparent border-l-current"
          />
          Pusti
        </Link>
      </div>
    </section>
  );
}

function EmptyCatalog() {
  return (
    <div className="border-kf-line bg-kf-surface rounded-kf-card mx-auto my-16 max-w-[520px] border border-dashed px-6.5 py-9 text-center">
      <div
        aria-hidden="true"
        className="kf-stripes border-kf-line mx-auto mb-5 h-[63px] w-28 rounded-lg border"
      />
      <h2 className="mb-2 text-lg leading-[1.25] font-semibold">Katalog je prazan</h2>
      <p className="text-kf-mut mx-auto max-w-[340px] text-[13px] leading-[1.55]">
        Nema objavljenih snimaka. Pokreni{" "}
        <code className="bg-kf-fill text-kf-ink3 rounded px-1.5 py-0.5 font-mono text-xs">
          npm run db:seed
        </code>{" "}
        da napuniš bazu.
      </p>
    </div>
  );
}
