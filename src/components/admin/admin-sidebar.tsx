import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "@/server/actions/admin-auth";

/**
 * Levi sticky sidebar po admin dizajnu: znak + `ADMIN` mikro-znacka, navigacija,
 * i na dnu povratak na sajt sa odjavom.
 *
 * Znak je isti CSS kvadrat kao u `SiteHeader` — namerno duplikat od 4 linije
 * umesto deljene komponente, jer su dimenzije i kontekst razliciti.
 *
 * Ispod `md` sidebar postaje horizontalna traka na vrhu (nema dovoljno sirine
 * za dve kolone), pa `md:` prefiksi na sticky/visini.
 */
export function AdminSidebar() {
  return (
    <aside className="border-kf-line-soft flex flex-col gap-6 border-b p-4 md:sticky md:top-0 md:h-screen md:gap-7 md:border-r md:border-b-0 md:px-4.5 md:py-5">
      <div className="flex items-center gap-2.5 px-1.5">
        <span
          aria-hidden="true"
          className="border-kf-accent flex size-5 items-center justify-center rounded-md border-[1.5px]"
        >
          <span className="bg-kf-accent block size-1.25 rounded-[1px]" />
        </span>
        <Link href="/admin" className="kf-focus-ring rounded-sm text-[15px] font-semibold tracking-[-0.02em]">
          Keyframe
        </Link>
        <span className="border-kf-line-strong text-kf-mut rounded-[5px] border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em]">
          ADMIN
        </span>
      </div>

      <AdminNav />

      <div className="flex items-center gap-3 md:mt-auto md:flex-col md:items-stretch md:gap-3.5">
        <form action={logoutAction}>
          <button
            type="submit"
            className="border-kf-line hover:bg-kf-fill kf-focus-ring rounded-kf-btn w-full cursor-pointer border px-3 py-2 text-[13px] transition-colors"
          >
            Odjava
          </button>
        </form>
        <Link
          href="/"
          className="text-kf-mut hover:text-kf-accent kf-focus-ring rounded-sm px-1.5 text-[13px] transition-colors"
        >
          ← Nazad na sajt
        </Link>
      </div>
    </aside>
  );
}
