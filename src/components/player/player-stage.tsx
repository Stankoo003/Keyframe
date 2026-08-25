"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChapterList } from "@/components/chapter-list";
import type { ChapterDto, SubtitleDto } from "@/domain/video";
import { currentChapterIndex } from "@/lib/format";
import { thumbnailsUrl } from "@/lib/media";
import { clearProgress, readProgress, saveProgress } from "@/lib/playback-progress";

import { PlayerSurface } from "./player-surface";
import { ResumePrompt } from "./resume-prompt";
import { usePlayer } from "./use-player";
import { useThumbnails } from "./use-thumbnails";

/** Koliko cesto se pozicija upisuje dok video svira. */
const SAVE_INTERVAL_MS = 5000;

/** Koliko dugo ponuda za nastavak stoji pre nego sto sama nestane. */
const RESUME_PROMPT_MS = 8000;

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
  videoId,
  src,
  title,
  poster,
  chapters,
  durationSeconds,
  subtitles,
  children,
}: {
  /** `Video.id` iz baze — kljuc za pamcenje pozicije; stabilan i kad se slug promeni. */
  videoId: string;
  src: string;
  title: string;
  poster?: string | null;
  chapters: readonly ChapterDto[];
  durationSeconds: number;
  /** Prosledjuje se kroz — samo <video> ih koristi. */
  subtitles: readonly SubtitleDto[];
  children?: React.ReactNode;
}) {
  const player = usePlayer(src);
  const { state, actions } = player;

  /*
   * Sličice se nalaze po konvenciji, pored manifesta — nema kolone u bazi, pa
   * ni `VideoDetail` ni `page.tsx` ne moraju da znaju za njih. Kad ih nema,
   * hook vrati prazan niz i hover preview se prosto ne pojavljuje.
   */
  const thumbnails = useThumbnails(useMemo(() => thumbnailsUrl(src), [src]));

  const starts = useMemo(() => chapters.map((chapter) => chapter.startSeconds), [chapters]);
  const activeChapter = currentChapterIndex(starts, state.currentTime);

  // ---- Ponuda za nastavak ----------------------------------------------------

  /**
   * Sacuvana pozicija se cita JEDNOM, kroz lazy initializer — ne u efektu.
   *
   * Na serveru `readProgress` vraca null (nema `window`), a na klijentu pravu
   * vrednost. Hidratacija se time ne razilazi jer je prikaz ponude ionako
   * uslovljen sa `state.ready`, sto je pri hidrataciji jos false: obe strane
   * renderuju isto, a vrednost samo ceka da trajanje stigne.
   */
  const [savedPosition] = useState<number | null>(() => readProgress(videoId));
  const [dismissed, setDismissed] = useState(false);
  /**
   * Jednosmerna reza: cim korisnik tastature UNUDJE u ponudu (Tab do jednog
   * od dugmadi), auto-nestajanje se trajno otkazuje. Bez ovoga bi sporiji
   * korisnik citaca ekrana mogao da izgubi ponudu tacno dok je pokusava
   * dosegnuti — takmicenje sa satom koje korisnik ne moze da vidi unapred.
   */
  const [promptEngaged, setPromptEngaged] = useState(false);
  const onPromptFocusChange = useCallback((focused: boolean) => {
    if (focused) setPromptEngaged(true);
  }, []);

  /**
   * Ponuda je IZVEDENA, ne drzi se u zasebnom stanju.
   *
   * Uslov `state.ready && duration > 0` je bitan: seek pre metapodataka ne radi.
   * `dismissed` je jednosmeran, pa se ponuda pokazuje najvise jednom po
   * otvaranju — ni posle premotavanja, ni ako trajanje ponovo prodje kroz nulu.
   */
  const showResume =
    !dismissed &&
    savedPosition !== null &&
    state.ready &&
    state.duration > 0 &&
    savedPosition < state.duration;

  // Ponuda sama nestaje — ignorisanje je validan odgovor i ne sme da blokira sliku.
  // ALI ne dok je korisnik tastature aktivno u njoj (`promptEngaged`) — vidi
  // komentar uz `onPromptFocusChange` gore.
  useEffect(() => {
    if (!showResume || promptEngaged) return;
    const timer = setTimeout(() => setDismissed(true), RESUME_PROMPT_MS);
    return () => clearTimeout(timer);
  }, [showResume, promptEngaged]);

  const onResume = useCallback(() => {
    if (savedPosition !== null) actions.seek(savedPosition);
    setDismissed(true);
  }, [savedPosition, actions]);

  const onRestart = useCallback(() => {
    clearProgress(videoId);
    setDismissed(true);
  }, [videoId]);

  // ---- Upis pozicije ---------------------------------------------------------

  /**
   * Najsvezije vrednosti za upis, van React stanja.
   *
   * Upis ide na tajmer i iz `pagehide` handlera — oba bi, da citaju iz closure-a,
   * videla vrednost iz trenutka kad je efekat postavljen. Ref uvek nosi tekucu.
   */
  const latestRef = useRef({ time: 0, duration: 0 });

  useEffect(() => {
    latestRef.current = { time: state.currentTime, duration: state.duration };
  }, [state.currentTime, state.duration]);

  useEffect(() => {
    const flush = () => {
      const { time, duration } = latestRef.current;
      if (duration > 0) saveProgress(videoId, time, duration);
    };

    const timer = setInterval(flush, SAVE_INTERVAL_MS);

    // `pagehide` hvata i zatvaranje taba i navigaciju unazad (bfcache), gde
    // `beforeunload` na mobilnim browserima ume da ne opali.
    window.addEventListener("pagehide", flush);

    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      flush(); // odlazak sa stranice unutar aplikacije
    };
  }, [videoId]);

  return (
    <>
      <PlayerSurface
        player={player}
        title={title}
        poster={poster}
        chapterStarts={starts}
        currentChapter={activeChapter}
        thumbnails={thumbnails}
        subtitles={subtitles}
        resumePromptSeconds={showResume ? savedPosition : null}
        overlay={
          showResume && savedPosition !== null ? (
            <ResumePrompt
              seconds={savedPosition}
              onResume={onResume}
              onRestart={onRestart}
              onFocusWithinChange={onPromptFocusChange}
            />
          ) : null
        }
      />

      {children}

      <ChapterList
        chapters={chapters}
        durationSeconds={durationSeconds}
        thumbnails={thumbnails}
        activeIndex={activeChapter}
        onSeek={actions.seek}
      />
    </>
  );
}
