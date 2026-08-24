import Link from "next/link";

import { logoutAction, requireAdminSession } from "@/server/actions/admin-auth";

/**
 * Chrome za sve ULOGOVANE `/admin/*` rute. `(protected)` je route GROUP — ne
 * dodaje segment u URL, ali `/admin/login` zivi VAN ove grupe (kao rodbratski
 * fajl `src/app/admin/login/page.tsx`) bas da ne bi prosao kroz
 * `requireAdminSession()` ispod — inace bi se login stranica sama
 * redirektovala u beskonacnu petlju (nema sesije → redirect na login → login
 * i sam trazi sesiju → redirect na login → ...).
 *
 * `requireAdminSession()` ovde je odbrana u dubinu pored `src/proxy.ts`:
 * middleware je primarna barijera za `/admin/*`, ova provera je jeftina
 * dodatna garancija za sigurnosnu granicu ovog tipa.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();

  return (
    <div className="min-h-full">
      <header className="border-kf-line-soft bg-kf-bg/70 sticky top-0 z-20 border-b backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-360 items-center justify-between gap-4 px-5 py-4 md:px-12">
          <Link
            href="/admin"
            className="kf-focus-ring rounded-sm text-[15px] font-semibold tracking-[-0.02em]"
          >
            Keyframe admin
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="border-kf-line hover:bg-kf-fill focus-visible:outline-kf-accent rounded-kf-btn cursor-pointer border px-3 py-1.5 text-[13px] focus-visible:outline-2"
            >
              Odjava
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-360 px-5 py-8 md:px-12">{children}</main>
    </div>
  );
}
