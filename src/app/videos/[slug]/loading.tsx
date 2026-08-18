import { SiteHeader } from "@/components/site-header";

/** Detail loading — spinner u okviru plejera + skeleton redovi, po mockupu. */
export default function VideoDetailLoading() {
  return (
    <>
      <SiteHeader showBack />

      <main
        className="grid grid-cols-1 items-start gap-6 px-4 pt-5 pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7.5 lg:px-5 lg:pt-6.5 lg:pb-12"
        aria-busy="true"
      >
        <span className="sr-only">Učitavanje snimka…</span>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[#0b0d10]">
            <span className="kf-spin border-t-kf-blue block size-8.5 rounded-full border-[3px] border-white/20" />
            <span className="absolute bottom-3.5 left-4 font-mono text-[10px] text-white/45">
              učitavanje manifesta…
            </span>
          </div>

          <div className="kf-pulse bg-kf-skel h-7.5 w-[58%] rounded-[7px]" />

          <div className="flex flex-col gap-2">
            <div className="bg-kf-skel h-3 w-full rounded" />
            <div className="bg-kf-skel h-3 w-[92%] rounded" />
            <div className="bg-kf-skel h-3 w-[64%] rounded" />
          </div>
        </div>

        <aside className="border-kf-line bg-kf-bg2 rounded-xl border p-3.5">
          <div className="bg-kf-skel mx-0.5 mb-3.5 h-3.5 w-22 rounded" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="border-kf-line flex items-center gap-3 rounded-[9px] border px-2.5 py-2.5"
              >
                <div className="bg-kf-skel h-2.75 w-10.5 rounded" />
                <div className="bg-kf-skel h-2.75 flex-1 rounded" />
              </div>
            ))}
          </div>
        </aside>
      </main>
    </>
  );
}
