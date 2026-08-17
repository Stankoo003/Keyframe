import { SiteHeader } from "@/components/site-header";
import { VideoCard } from "@/components/video-card";
import { listPublishedVideos } from "@/server/videos";

/**
 * Browse — mreza objavljenih videa.
 *
 * Serverska komponenta koja cita bazu direktno. Poziv sopstvenog API-ja preko
 * HTTP-a bio bi mrezni skok sa servera na samog sebe; `/api/videos` postoji za
 * spoljne potrosace i deli isti kod iz `src/server/videos.ts`.
 *
 * Greske se NE hvataju ovde — puštaju se do `error.tsx`, da otkaz baze bude
 * vidljiv umesto da se pretvori u praznu stranicu.
 */
export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const { data: videos, meta } = await listPublishedVideos({
    page: 1,
    pageSize: 24,
  });

  return (
    <>
      <SiteHeader />

      <main className="px-5 pt-6.5 pb-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="mb-1.5 text-2xl leading-[1.15] font-semibold tracking-[-0.02em]">
              Browse
            </h1>
            <p className="text-kf-mut text-[13px] leading-[1.4]">
              {meta.total} {meta.total === 1 ? "snimak" : "snimaka"} · podeljeni na poglavlja
            </p>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="border-kf-line bg-kf-bg mx-auto my-10 max-w-[520px] rounded-xl border border-dashed px-6.5 py-7.5 text-center">
            <div
              aria-hidden="true"
              className="kf-stripes border-kf-line mx-auto mb-4.5 h-[63px] w-28 rounded-lg border"
            />
            <h2 className="mb-1.5 text-lg leading-[1.25] font-semibold">Katalog je prazan</h2>
            <p className="text-kf-mut mx-auto max-w-[340px] text-[13px] leading-[1.55]">
              Nema objavljenih snimaka. Pokreni{" "}
              <code className="bg-kf-bg2 rounded px-1.5 py-0.5 font-mono text-xs">
                npm run db:seed
              </code>{" "}
              da napuniš bazu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] sm:gap-5.5">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
