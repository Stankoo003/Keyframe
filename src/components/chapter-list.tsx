"use client";

import { useEffect, useRef } from "react";

import type { ChapterDto } from "@/domain/video";
import { chapterDurations, formatTime } from "@/lib/format";

import { cueAt } from "./player/thumbnails";
import type { ThumbnailMap } from "./player/use-thumbnails";

/**
 * Poglavlja kao mreza kartica ispod plejera.
 *
 * Klik skace na pocetak poglavlja. Klik meta je CELA kartica, a ne crtica na
 * traci: crtica je siroka 2px, sto je duboko ispod pristupacnog minimuma, a da
 * bi bila klikabilna morala bi da stoji iznad `<input type="range">`-a — gde bi
 * gutala prevlacenje i pokvarila premotavanje.
 *
 * Klijentska je jer prima `onSeek` i mora da prati tekuce poglavlje; stanje
 * dobija od `PlayerStage`, ne racuna ga sama.
 *
 * Sličica kartice je kadar sa POCETKA poglavlja, isecen iz istog sprite-a koji
 * hrani preview na seek traci (`scripts/make-thumbs.sh`). Dok sprite ne stigne —
 * ili kad ga video uopste nema — stoji prugasta povrsina, isti placeholder jezik
 * kao svuda u dizajnu.
 */
export function ChapterList({
  chapters,
  durationSeconds,
  activeIndex,
  onSeek,
  thumbnails,
}: {
  chapters: readonly ChapterDto[];
  durationSeconds: number;
  /** Sličice snimka. Prazna mapa = kartice ostaju prugaste. */
  thumbnails: ThumbnailMap;
  /** Index tekuceg poglavlja, ili -1. */
  activeIndex: number;
  onSeek: (seconds: number) => void;
}) {
  const lengths = chapterDurations(
    chapters.map((chapter) => chapter.startSeconds),
    durationSeconds,
  );

  const listRef = useRef<HTMLUListElement | null>(null);

  /**
   * Drzi tekucu karticu u vidokrugu kad mreza ima skrol.
   *
   * `block: "nearest"` je bitno — sa podrazumevanim `"start"` bi svaka promena
   * poglavlja trzala celu stranicu. Ovako se pomera samo ako kartica zaista
   * ispadne iz okvira, i to samo unutar liste.
   */
  useEffect(() => {
    if (activeIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    if (list.scrollHeight <= list.clientHeight) return;

    list.children[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <section className="border-kf-line-soft mt-8.5 border-t pt-6.5">
      {chapters.length === 0 ? (
        <div className="border-kf-line rounded-kf-thumb border border-dashed px-4 py-7 text-center">
          <p className="text-kf-mut mx-auto max-w-[42ch] text-[13px] leading-[1.55]">
            Ovaj snimak nema poglavlja. Premotavaj po traci ili skači strelicama.
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className="grid max-h-140 list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5 overflow-y-auto pr-1"
        >
          {chapters.map((chapter, index) => {
            const active = index === activeIndex;
            const cue = cueAt(thumbnails.cues, chapter.startSeconds);

            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() => onSeek(chapter.startSeconds)}
                  aria-current={active ? "true" : undefined}
                  title={`Skoči na ${formatTime(chapter.startSeconds)} — traje ${formatTime(lengths[index] ?? 0)}`}
                  data-active={active}
                  className="border-kf-line bg-kf-surface data-[active=true]:border-kf-accent-line data-[active=true]:bg-kf-accent-soft hover:border-kf-accent-line focus-visible:outline-kf-accent w-full cursor-pointer rounded-[13px] border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {/*
                   * Isecak se dobija procentualnim `background-size`-om, ne
                   * pikselima: kartica je fluidna (grid `auto-fill`), pa bi
                   * fiksna velicina sprite-a radila samo na jednoj sirini.
                   * Uz `aspect-video` isecak zadrzava 16:9 na svakoj sirini.
                   */}
                  <span
                    aria-hidden="true"
                    data-testid="chapter-thumbnail"
                    className="kf-stripes border-kf-line block aspect-video overflow-hidden rounded-[9px] border bg-cover"
                    style={
                      cue === null
                        ? undefined
                        : {
                            backgroundImage: `url("${cue.src}")`,
                            backgroundSize: `${thumbnails.cols * 100}% ${thumbnails.rows * 100}%`,
                            // Deljenje sa (n - 1): kod procentualne pozicije 100%
                            // znaci "poravnaj DESNU ivicu", pa je poslednja
                            // kolona na 100%, a ne na cols/(cols) * 100.
                            backgroundPosition: [
                              thumbnails.cols > 1
                                ? `${(cue.x / cue.w / (thumbnails.cols - 1)) * 100}%`
                                : "0%",
                              thumbnails.rows > 1
                                ? `${(cue.y / cue.h / (thumbnails.rows - 1)) * 100}%`
                                : "0%",
                            ].join(" "),
                          }
                    }
                  />
                  <span className="mt-2.5 flex items-baseline justify-between gap-2.5">
                    <span className="text-[14px] leading-[1.3] font-medium tracking-[-0.01em]">
                      <span
                        data-active={active}
                        className="text-kf-mut2 data-[active=true]:text-kf-accent font-mono"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>{" "}
                      · {chapter.title}
                    </span>
                    <span className="text-kf-mut2 shrink-0 font-mono text-[11px]">
                      {formatTime(chapter.startSeconds)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
