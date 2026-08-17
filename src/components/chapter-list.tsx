import type { ChapterDto } from "@/domain/video";
import { chapterDurations, formatTime } from "@/lib/format";

/**
 * Poglavlja kao mreza kartica ispod plejera, po dizajnu.
 *
 * Dizajn kartice prikazuje kao klikabilne, sa aktivnim stanjem po trenutnoj
 * poziciji. To bi trazilo da poglavlja dele stanje sa plejerom, dakle da postanu
 * klijentska komponenta — van obima redizajna. Zato su kartice staticne i ovo
 * ostaje serverska komponenta; skok na poglavlje je zaseban zadatak.
 *
 * Sličice iz dizajna se ne generisu (nemamo kadrove po poglavlju), pa stoji
 * prugasta povrsina — isti placeholder jezik kao svuda u dizajnu.
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
    <section className="border-kf-line-soft mt-8.5 border-t pt-6.5">
      {chapters.length === 0 ? (
        <div className="border-kf-line rounded-kf-thumb border border-dashed px-4 py-7 text-center">
          <p className="text-kf-mut mx-auto max-w-[42ch] text-[13px] leading-[1.55]">
            Ovaj snimak nema poglavlja. Premotavaj po traci ili skači strelicama.
          </p>
        </div>
      ) : (
        /*
         * Visina je ogranicena namerno. Seed pravi poglavlje na svakih 6s, pa
         * osmominutni snimak daje 85 kartica — bez kapice bi one same bile
         * dvadesetak ekrana i pojele bi ostatak stranice.
         */
        <ul className="grid max-h-140 list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5 overflow-y-auto pr-1">
          {chapters.map((chapter, index) => (
            <li
              key={chapter.id}
              className="border-kf-line bg-kf-surface rounded-[13px] border p-2.5"
            >
              <div
                aria-hidden="true"
                className="kf-stripes border-kf-line h-18.5 rounded-[9px] border"
              />
              <div className="mt-2.5 flex items-baseline justify-between gap-2.5">
                <span className="text-[14px] leading-[1.3] font-medium tracking-[-0.01em]">
                  <span className="text-kf-mut2 font-mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>{" "}
                  · {chapter.title}
                </span>
                <span
                  className="text-kf-mut2 shrink-0 font-mono text-[11px]"
                  title={`traje ${formatTime(lengths[index] ?? 0)}`}
                >
                  {formatTime(chapter.startSeconds)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
