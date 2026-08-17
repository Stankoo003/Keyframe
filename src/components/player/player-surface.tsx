"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CONTROLS_HIDE_MS, SEEK_STEP_SECONDS, VOLUME_STEP } from "./constants";
import { PlayerControls } from "./player-controls";
import type { PlayerActions, PlayerState } from "./use-player";

/**
 * Okvir slike: <video>, kontrole, prečice i auto-skrivanje.
 *
 * NE zove `usePlayer` — dobija gotovo stanje i akcije od `PlayerStage`. Razlog:
 * i lista poglavlja ispod plejera mora da zna `currentTime` i da može da pozove
 * `seek`, pa hook mora da živi iznad oboje. Da ga ova komponenta zove, postojala
 * bi dva nezavisna plejera na istoj stranici.
 *
 * Sam ne dodiruje hls.js — sav HLS je iza engine-a. <video> je bez `controls`
 * atributa: nativne kontrole su isključene, koristimo isključivo naš UI.
 */
export function PlayerSurface({
  player,
  title,
  poster,
  chapterStarts,
  currentChapter,
}: {
  player: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    containerRef: React.RefObject<HTMLElement | null>;
    state: PlayerState;
    actions: PlayerActions;
  };
  title?: string;
  poster?: string | null;
  /** Pocetci poglavlja u sekundama — crtice na traci. */
  chapterStarts?: readonly number[];
  /** Index tekuceg poglavlja; njegova crtica se boji u cyan. */
  currentChapter?: number;
}) {
  const { videoRef, containerRef, state, actions } = player;
  const [idle, setIdle] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Vidljivost se IZVODI, ne drži u zasebnom stanju: na pauzi su kontrole uvek
   * tu, a dok svira zavise od mirovanja. Da se pauza rešava `setState`-om u
   * efektu, svaki play/pause bi izazvao dodatni render.
   */
  const controlsVisible = !state.playing || !idle;

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setIdle(true), CONTROLS_HIDE_MS);
  }, []);

  /** Interakcija — pokaži kontrole i počni odbrojavanje ispočetka. */
  const revealControls = useCallback(() => {
    setIdle(false);
    scheduleHide();
  }, [scheduleHide]);

  // Odbrojavanje teče samo dok video svira; na pauzi se poništava.
  useEffect(() => {
    if (!state.playing) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }

    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [state.playing, scheduleHide]);

  /**
   * Prečice rade samo kad je plejer fokusiran — zato je na kontejneru, a ne na
   * `document`. Inače bi space skrolovao stranicu, a strelice pomerale fokus
   * kroz listu poglavlja pored plejera.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Klizači i padajuće liste unutar kontrola sami obrađuju strelice —
      // bez ovoga bi zvuk i premotavanje odradili duplo.
      const target = event.target as HTMLElement;
      const inFormControl =
        target instanceof HTMLInputElement || target instanceof HTMLSelectElement;

      let handled = true;

      switch (event.key) {
        case " ":
        case "k":
        case "K":
          if (inFormControl) return; // space na dugmetu je već "klik"
          actions.togglePlay();
          break;
        case "ArrowLeft":
          if (inFormControl) return;
          actions.skip(-SEEK_STEP_SECONDS);
          break;
        case "ArrowRight":
          if (inFormControl) return;
          actions.skip(SEEK_STEP_SECONDS);
          break;
        case "ArrowUp":
          if (inFormControl) return;
          actions.nudgeVolume(VOLUME_STEP);
          break;
        case "ArrowDown":
          if (inFormControl) return;
          actions.nudgeVolume(-VOLUME_STEP);
          break;
        case "f":
        case "F":
          actions.toggleFullscreen();
          break;
        case "m":
        case "M":
          actions.toggleMute();
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
        revealControls();
      }
    },
    [actions, revealControls],
  );

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      tabIndex={0}
      role="region"
      aria-label={title ? `Plejer: ${title}` : "Video plejer"}
      onKeyDown={onKeyDown}
      onPointerMove={revealControls}
      onFocus={revealControls}
      className="border-kf-line rounded-kf-card focus-visible:outline-kf-accent relative overflow-hidden border bg-black focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        aria-label={title ? `Video: ${title}` : "Video"}
        onClick={actions.togglePlay}
        className="aspect-video w-full cursor-pointer bg-black"
      />

      {state.error ? (
        <div className="text-kf-danger absolute inset-0 flex items-center justify-center p-4 text-center text-sm">
          Greška pri reprodukciji: {state.error}
        </div>
      ) : (
        <div
            data-visible={controlsVisible}
            className="absolute inset-x-0 bottom-0 opacity-0 transition-opacity duration-200 data-[visible=true]:opacity-100"
          >
            <PlayerControls
              state={state}
              actions={actions}
              chapterStarts={chapterStarts}
              currentChapter={currentChapter}
            />
        </div>
      )}
    </div>
  );
}
