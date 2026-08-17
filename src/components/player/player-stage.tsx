"use client";

import { useMemo } from "react";

import { ChapterList } from "@/components/chapter-list";
import type { ChapterDto } from "@/domain/video";
import { currentChapterIndex } from "@/lib/format";

import { PlayerSurface } from "./player-surface";
import { usePlayer } from "./use-player";

/**
 * Spaja plejer i listu poglavlja oko JEDNOG poziva `usePlayer`.
 *
 * Poglavlja moraju da znaju `currentTime` (da bi se tekuce oznacilo) i da mogu
 * da pozovu `seek` (da bi klik skakao). Da svaka komponenta zove hook sama,
 * dobili bismo dva nezavisna stanja nad istim <video> elementom.
 *
 * `children` su naslov i opis — stizu SERVER-renderovani iz `page.tsx` i samo
 * prolaze kroz ovu komponentu. Tako oni ostaju van klijentskog bundle-a.
 */
export function PlayerStage({
  src,
  title,
  poster,
  chapters,
  durationSeconds,
  children,
}: {
  src: string;
  title: string;
  poster?: string | null;
  chapters: readonly ChapterDto[];
  durationSeconds: number;
  children?: React.ReactNode;
}) {
  const player = usePlayer(src);
  const { state, actions } = player;

  const starts = useMemo(() => chapters.map((chapter) => chapter.startSeconds), [chapters]);
  const activeChapter = currentChapterIndex(starts, state.currentTime);

  return (
    <>
      <PlayerSurface
        player={player}
        title={title}
        poster={poster}
        chapterStarts={starts}
        currentChapter={activeChapter}
      />

      {children}

      <ChapterList
        chapters={chapters}
        durationSeconds={durationSeconds}
        activeIndex={activeChapter}
        onSeek={actions.seek}
      />
    </>
  );
}
