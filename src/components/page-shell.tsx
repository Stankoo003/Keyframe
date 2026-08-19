/**
 * Jedini nosilac horizontalnog paddinga i maksimalne sirine stranice.
 *
 * Pre ovoga je isti niz klasa bio prepisan u pet fajlova (katalog, njegov
 * skeleton, detalj, njegov skeleton i greska), pa bi promena razmaka trazila pet
 * izmena — i prva zaboravljena bi se videla kao poskakivanje sadrzaja.
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
  return <div className={`mx-auto w-full max-w-360 px-5 md:px-12 ${className}`}>{children}</div>;
}
