/**
 * Jedini nosilac horizontalnog paddinga i maksimalne sirine stranice.
 *
 * Pre ovoga je isti niz klasa bio prepisan u pet fajlova (katalog, njegov
 * skeleton, detalj, njegov skeleton i greska), pa bi promena razmaka trazila pet
 * izmena — i prva zaboravljena bi se videla kao poskakivanje sadrzaja.
 *
 * `<main>`, ne `<div>`: svaka stranica koja koristi `PageShell` ga stavlja
 * TACNO oko svog glavnog sadrzaja (ispod `SiteHeader`-a), pa je ovo jedino
 * mesto gde `<main>` landmark treba da zivi — bez njega citac ekrana nema
 * nacin da preskoci pravo na sadrzaj, mimo zaglavlja.
 *
 * Serverska komponenta: samo omotac, bez stanja.
 */
export function PageShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <main className={`mx-auto w-full max-w-360 px-5 md:px-12 ${className}`}>{children}</main>;
}
