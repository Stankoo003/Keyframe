import Link from "next/link";

/**
 * Zaglavlje po mockupu. Na detalju dobija dugme za nazad.
 *
 * Serverska komponenta — nema stanja, sve je markup i jedan `<Link>`.
 */
export function SiteHeader({ showBack = false }: { showBack?: boolean }) {
  return (
    <header className="border-kf-line bg-kf-bg sticky top-0 z-20 flex items-center gap-4 border-b px-5 py-3.5">
      {showBack && (
        <Link
          href="/"
          className="border-kf-line text-kf-ink2 hover:border-kf-blue-line hover:text-kf-blue flex items-center gap-2 rounded-lg border py-1.5 pr-2.5 pl-1.5 text-xs font-medium transition-colors"
        >
          <span
            aria-hidden="true"
            className="ml-1.5 block h-0 w-0 border-y-4 border-r-6 border-y-transparent border-r-current"
          />
          Nazad
        </Link>
      )}

      <Link href="/" className="flex items-center gap-2.5">
        <span aria-hidden="true" className="bg-kf-blue block size-4 rounded-[3px]" />
        <span className="text-[15px] leading-none font-semibold tracking-[-0.01em]">Keyframe</span>
      </Link>
    </header>
  );
}
