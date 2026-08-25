import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdminSession } from "@/server/actions/admin-auth";

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
 *
 * Layout je po dizajnu dvokolonski (sidebar 236px + sadrzaj); ispod `md`
 * kolone se slazu jedna ispod druge.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[236px_minmax(0,1fr)]">
      <AdminSidebar />
      <main className="w-full min-w-0 px-5 py-6 pb-18 md:px-8.5">{children}</main>
    </div>
  );
}
