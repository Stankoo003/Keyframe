import type { ChapterDto } from "@/domain/video";
import { chapterDurations, formatTime } from "@/lib/format";

/**
 * Panel poglavlja po mockupu.
 *
 * Mockup grupise poglavlja po cinovima i sklapa ih harmonikom. Nas model nema
 * cinove, pa je lista ravna — i time nestaje jedini razlog da ovo bude
 * klijentska komponenta.
 */
export function ChapterList({
  chapters,
  durationSeconds,
}: {
  chapters: readonly ChapterDto[];
  durationSeconds: number;
}) {
  const lengths = chapterDurations(
    chapters.map((chapter) => chapter.startSeconds),
    durationSeconds,
  );

  return (
    <aside className="border-kf-line bg-kf-bg2 rounded-xl border p-3.5 lg:sticky lg:top-[82px] lg:max-h-[620px] lg:overflow-y-auto">
      <div className="flex items-baseline justify-between px-0.5 pb-3">
        <h2 className="text-sm leading-none font-semibold">Poglavlja</h2>
        <span className="text-kf-mut font-mono text-[10.5px]">{chapters.length}</span>
      </div>

      {chapters.length === 0 ? (
        <div className="border-kf-line rounded-[10px] border border-dashed px-4 py-6 text-center">
          <div
            aria-hidden="true"
            className="kf-stripes border-kf-line mx-auto mb-3.5 size-[34px] rounded-lg border"
          />
          <p className="text-kf-mut text-[12.5px] leading-[1.55]">
            Ovaj snimak nema poglavlja. Pomeraj se po traci ili skači strelicama po 10 sekundi.
          </p>
        </div>
      ) : (
        <ul className="flex list-none flex-col">
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <div className="hover:bg-kf-blue-soft flex items-center gap-3 rounded-[7px] px-2 py-2 transition-colors">
                <span className="text-kf-blue min-w-12 font-mono text-[11px]">
                  {formatTime(chapter.startSeconds)}
                </span>
                <span className="text-kf-ink flex-1 text-[12.5px] leading-[1.35]">
                  {chapter.title}
                </span>
                <span className="text-kf-mut font-mono text-[10.5px]">
                  {formatTime(lengths[index] ?? 0)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
