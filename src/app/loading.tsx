import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";

/**
 * Katalog loading — skeleton hero + mreza.
 *
 * Next ga prikazuje automatski dok `page.tsx` ceka bazu. Oblik prati oblik
 * stvarne stranice, da sadrzaj ne poskoci kad stigne.
 */
export default function BrowseLoading() {
  return (
    <>
      <SiteHeader />

      <PageShell className="pt-7 pb-20">
        <div aria-busy="true">
          <span className="sr-only">Učitavanje kataloga…</span>

          <div className="bg-kf-skel rounded-kf-card relative min-h-105 overflow-hidden lg:min-h-130">
            <div className="kf-sweep absolute inset-0 bg-linear-to-r from-transparent via-white/8 to-transparent" />
          </div>

          <div className="mt-12 mb-4.5 flex items-baseline gap-3.5">
            <div className="kf-pulse bg-kf-skel h-5.5 w-32 rounded-[7px]" />
            <div className="kf-pulse bg-kf-skel h-3 w-24 rounded-[5px]" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(272px,1fr))]">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex flex-col">
                <div className="bg-kf-skel rounded-kf-thumb relative aspect-video overflow-hidden">
                  <div className="kf-sweep absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent" />
                </div>
                <div className="bg-kf-skel mt-3 h-3.5 w-[70%] rounded" />
                <div className="bg-kf-skel mt-1.75 h-2.75 w-[40%] rounded" />
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    </>
  );
}
