"use client";

import Link from "next/link";
import { useState } from "react";

import type { AdminVideoListItem } from "@/domain/admin-video";
import { togglePublishAction } from "@/server/actions/admin-videos";

type Filter = "sve" | "objavljeno" | "nacrt";

const TABS: readonly { key: Filter; label: string }[] = [
  { key: "sve", label: "Sve" },
  { key: "objavljeno", label: "Objavljeno" },
  { key: "nacrt", label: "Nacrt" },
];

/** Sirine kolona su iste za zaglavlje i redove — zato jedan deljen string. */
const COLS =
  "grid grid-cols-[minmax(0,2.4fr)_0.8fr_0.9fr] items-center gap-4 md:grid-cols-[minmax(0,2.4fr)_0.8fr_0.9fr_1fr_auto]";

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Lista snimaka kao tabela iz dizajna. Klijentska je SAMO zbog filter tabova;
 * prekidac objave unutar reda ostaje obicna `<form>` sa server action-om, pa
 * radi i bez JavaScript-a.
 *
 * Dizajn ovde ima i pretragu, `⋯` meni i paginaciju — nisu preuzeti jer bi bili
 * mrtva dugmad (nemamo ni pretragu ni dovoljno akcija za meni).
 */
export function VideoTable({ videos }: { videos: readonly AdminVideoListItem[] }) {
  const [filter, setFilter] = useState<Filter>("sve");

  const shown = videos.filter((video) =>
    filter === "sve" ? true : filter === "objavljeno" ? video.published : !video.published,
  );

  return (
    <div className="border-kf-line bg-kf-surface rounded-kf-card overflow-hidden border">
      <div className="border-kf-line-soft flex flex-wrap items-center gap-2 border-b px-5 py-3.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            aria-pressed={filter === tab.key}
            className={`kf-focus-ring cursor-pointer rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
              filter === tab.key
                ? "border-kf-ink bg-kf-ink text-kf-accent-ink"
                : "border-kf-line bg-kf-fill text-kf-ink2 hover:text-kf-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`${COLS} kf-micro border-kf-line-soft border-b px-5 py-3`}>
        <span>Snimak</span>
        <span>Trajanje</span>
        <span className="hidden md:block">Poglavlja</span>
        <span>Status</span>
        <span className="hidden md:block" />
      </div>

      {shown.length === 0 ? (
        <p className="text-kf-mut px-5 py-6 text-[13px]">Nema snimaka u ovom filteru.</p>
      ) : (
        <ul>
          {shown.map((video) => (
            <li
              key={video.id}
              className={`${COLS} border-kf-line-soft border-b px-5 py-3.5 transition-colors last:border-b-0 hover:bg-white/3`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="kf-stripes border-kf-line hidden h-9 w-16 shrink-0 rounded-[7px] border sm:block"
                />
                <div className="min-w-0">
                  <Link
                    href={`/admin/videos/${video.id}/edit`}
                    className="hover:text-kf-accent kf-focus-ring block truncate rounded-sm text-[14px] font-medium tracking-[-0.01em]"
                  >
                    {video.title}
                  </Link>
                  <p className="text-kf-mut2 mt-1 truncate font-mono text-[10px]">{video.slug}</p>
                </div>
              </div>

              <span className="text-kf-ink2 font-mono text-[12px]">
                {formatDuration(video.durationSeconds)}
              </span>

              <span className="text-kf-ink2 hidden font-mono text-[12px] md:block">
                {video.chapterCount}
              </span>

              <form action={togglePublishAction} className="justify-self-start">
                <input type="hidden" name="videoId" value={video.id} />
                <input type="hidden" name="slug" value={video.slug} />
                <input type="hidden" name="nextPublished" value={String(!video.published)} />
                <button
                  type="submit"
                  aria-pressed={video.published}
                  title={video.published ? "Klikni da vratiš u nacrt" : "Klikni da objaviš"}
                  className={`kf-focus-ring cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
                    video.published
                      ? "border-kf-accent-line bg-kf-accent-soft text-kf-accent"
                      : "border-kf-line bg-kf-fill text-kf-ink2 hover:text-kf-ink"
                  }`}
                >
                  {video.published ? "Objavljeno" : "Nacrt"}
                </button>
              </form>

              <Link
                href={`/admin/videos/${video.id}/edit`}
                className="text-kf-ink2 hover:text-kf-accent kf-focus-ring hidden rounded-sm text-[13px] transition-colors md:block"
              >
                Izmeni
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="text-kf-mut border-kf-line-soft border-t px-5 py-3.5 text-[13px]">
        Prikazano {shown.length} od {videos.length}
      </div>
    </div>
  );
}
