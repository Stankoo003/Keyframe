import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";

/** Detail loading — spinner u okviru plejera + skeleton redovi, po dizajnu. */
export default function VideoDetailLoading() {
  return (
    <>
      <SiteHeader showBack />

      <PageShell className="pt-7 pb-18">
        <div className="mx-auto max-w-275" aria-busy="true">
          <span className="sr-only">Učitavanje snimka…</span>

          <div className="min-w-0">
            <div className="kf-frame border-kf-line rounded-kf-card relative flex aspect-video items-center justify-center overflow-hidden border">
              <span className="kf-spin border-t-kf-accent block size-8.5 rounded-full border-[3px] border-white/15" />
              <span className="kf-micro absolute bottom-4 left-5">učitavanje manifesta…</span>
            </div>

            <div className="mt-6.5">
              <div className="kf-pulse bg-kf-skel h-8.5 w-[58%] rounded-[7px]" />
              <div className="bg-kf-skel mt-3.5 h-3 w-40 rounded" />

              <div className="mt-4 flex flex-col gap-2">
                <div className="bg-kf-skel h-3 w-full rounded" />
                <div className="bg-kf-skel h-3 w-[92%] rounded" />
                <div className="bg-kf-skel h-3 w-[64%] rounded" />
              </div>
            </div>

            <div className="border-kf-line-soft mt-8.5 border-t pt-6.5">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="border-kf-line rounded-[13px] border p-2.5">
                    <div className="bg-kf-skel h-18.5 rounded-[9px]" />
                    <div className="bg-kf-skel mt-2.5 h-3 w-[70%] rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}
