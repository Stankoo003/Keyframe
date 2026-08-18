import { SiteHeader } from "@/components/site-header";

/**
 * Browse loading — skeleton mreza iz mockupa.
 *
 * Next ga prikazuje automatski dok `page.tsx` ceka bazu. Oblik skeletona prati
 * oblik kartice, da sadrzaj ne poskoci kad stigne.
 */
export default function BrowseLoading() {
  return (
    <>
      <SiteHeader />

      <main className="px-5 pt-6.5 pb-10" aria-busy="true">
        <span className="sr-only">Učitavanje kataloga…</span>

        <div className="kf-pulse bg-kf-skel mb-2 h-6.5 w-30 rounded-[7px]" />
        <div className="kf-pulse bg-kf-skel mb-6 h-3.5 w-55 rounded-[5px]" />

        <div className="grid grid-cols-2 gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] sm:gap-5.5">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2.5">
              <div className="bg-kf-skel relative aspect-video overflow-hidden rounded-[10px]">
                <div className="kf-sweep absolute inset-0 bg-linear-to-r from-transparent via-white/35 to-transparent" />
              </div>
              <div className="bg-kf-skel h-3 w-[70%] rounded" />
              <div className="bg-kf-skel h-2.5 w-[40%] rounded" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
