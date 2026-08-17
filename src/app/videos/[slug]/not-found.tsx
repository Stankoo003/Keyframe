import Link from "next/link";

import { PageShell } from "@/components/page-shell";
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

      <PageShell className="pt-7 pb-20">
        <div className="border-kf-line bg-kf-surface rounded-kf-card mx-auto my-16 max-w-130 border border-dashed px-6.5 py-9 text-center">
          <div
            aria-hidden="true"
            className="kf-stripes border-kf-line mx-auto mb-5 h-15.75 w-28 rounded-lg border"
          />

          <span className="bg-kf-fill kf-micro inline-block rounded-md px-2.5 py-1.5 tracking-[0.16em]">
            404
          </span>

          <h1 className="mt-4 mb-2 text-lg leading-tight font-semibold">Snimak nije pronađen</h1>

          <p className="text-kf-mut mx-auto mb-5 max-w-85 text-[13px] leading-[1.55]">
            Ne postoji snimak sa tom adresom, ili još nije objavljen.
          </p>

          <Link
            href="/"
            className="border-kf-line-strong text-kf-ink3 rounded-kf-btn hover:bg-kf-fill inline-block border px-4 py-2.5 text-[13px] font-medium transition-colors"
          >
            Nazad na katalog
          </Link>
        </div>
      </PageShell>
    </>
  );
}
