import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

/**
 * Nepoznat ili neobjavljen snimak.
 *
 * Isti odgovor za oba slucaja — po njemu se ne moze zakljuciti da nacrt
 * postoji. Serverska komponenta, `notFound()` je poziva.
 */
export default function VideoNotFound() {
  return (
    <>
      <SiteHeader showBack />

      <main className="px-5 pt-6.5 pb-10">
        <div className="border-kf-line bg-kf-bg mx-auto my-10 max-w-[520px] rounded-xl border border-dashed px-6.5 py-7.5 text-center">
          <div
            aria-hidden="true"
            className="kf-stripes border-kf-line mx-auto mb-4.5 h-[63px] w-28 rounded-lg border"
          />

          <span className="bg-kf-bg2 text-kf-mut inline-block rounded-md px-2.5 py-1 font-mono text-[10.5px] leading-none font-medium tracking-[0.05em]">
            404
          </span>

          <h1 className="mt-3.5 mb-1.5 text-lg leading-[1.25] font-semibold">
            Snimak nije pronađen
          </h1>

          <p className="text-kf-mut mx-auto mb-5 max-w-[340px] text-[13px] leading-[1.55]">
            Ne postoji snimak sa tom adresom, ili još nije objavljen.
          </p>

          <Link
            href="/"
            className="border-kf-blue-line bg-kf-blue-soft text-kf-blue inline-block rounded-lg border px-3.5 py-2.5 text-[12.5px] font-medium transition-opacity hover:opacity-90"
          >
            Nazad na katalog
          </Link>
        </div>
      </main>
    </>
  );
}
