import Link from "next/link";

/**
 * Zaglavlje po dizajnu: lepljivo, sa zamucenom podlogom, znak od cyan kvadrata
 * sa tackicom unutra, i mono mikro-labela desno.
 *
 * `meta` prima STVARAN podatak (npr. "solar-eclipse · 85 poglavlja"); dizajn tu
 * ima "Space · Season 2 · Ep. 04", ali model nema ni serije ni epizode, pa se
 * prikazuje ono sto zaista postoji. Bez propsa se desna strana ne renderuje.
 *
 * Pretraga i navigacija po kategorijama iz dizajna namerno NISU preuzete —
 * nemamo ni pretragu ni kategorije, pa bi bile mrtva dugmad.
 *
 * Serverska komponenta — nema stanja, sve je markup i `<Link>`.
 */
export function SiteHeader({ showBack = false, meta }: { showBack?: boolean; meta?: string }) {
  return (
    <header className="border-kf-line-soft bg-kf-bg/70 sticky top-0 z-20 border-b backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex w-full max-w-360 items-center justify-between gap-8 px-5 py-4.5 md:px-12">
        <div className="flex items-center gap-5.5">
          {showBack && (
            <>
              <Link
                href="/"
                className="text-kf-mut hover:text-kf-accent flex items-center gap-2.5 text-[13px] transition-colors"
              >
                <span
                  aria-hidden="true"
                  className="block h-0 w-0 border-y-5 border-r-7 border-y-transparent border-r-current"
                />
                Nazad
              </Link>
              <span aria-hidden="true" className="bg-kf-line-strong h-4.5 w-px" />
            </>
          )}

          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="border-kf-accent flex size-5.5 items-center justify-center rounded-md border-[1.5px]"
            >
              <span className="bg-kf-accent block size-1.5 rounded-[1px]" />
            </span>
            <span className="text-[17px] leading-none font-semibold tracking-[-0.02em]">
              Keyframe
            </span>
          </Link>
        </div>

        {meta && <span className="kf-micro hidden truncate sm:block">{meta}</span>}
      </div>
    </header>
  );
}
