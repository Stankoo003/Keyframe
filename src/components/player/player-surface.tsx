"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { SubtitleDto } from "@/domain/video";
import {
  getCaptionPrefsServerSnapshot,
  getCaptionPrefsSnapshot,
  resetCaptionPrefs,
  saveCaptionPrefs,
  subscribeCaptionPrefs,
  type CaptionPrefs,
} from "@/lib/caption-prefs";
import { formatTime } from "@/lib/format";

import { CaptionOverlay } from "./caption-overlay";
import { CaptionSettingsModal } from "./caption-settings-modal";
import { CONTROLS_HIDE_MS, SEEK_STEP_SECONDS, VOLUME_STEP } from "./constants";
import { PlayerControls } from "./player-controls";
import { useAnnouncer, useAnnounceOnChange } from "./use-announcer";
import { useSubtitleTracks } from "./use-subtitle-tracks";
import type { PlayerActions, PlayerState } from "./use-player";

/** Koliko se ceka pre objave pozicije — vidi `useAnnouncer`. */
const POSITION_ANNOUNCE_DELAY_MS = 600;

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
  overlay,
  resumePromptSeconds = null,
  subtitles = [],
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
  /** Npr. ponuda za nastavak gledanja — crta se preko slike, iznad kontrola. */
  overlay?: React.ReactNode;
  /**
   * Pozicija iz ponude za nastavak, ili `null` kad ponuda nije prikazana.
   * Zaseban od `overlay` (koji nosi samu JSX): ovde treba SAMO vrednost da bi
   * `useAnnounceOnChange` znao kad da najavi pojavu, bez parsiranja tudjeg
   * React stabla.
   */
  resumePromptSeconds?: number | null;
  /** Titlovi; prazno je legitimno i onemogucuje CC kontrolu. */
  subtitles?: readonly SubtitleDto[];
}) {
  const { videoRef, containerRef, state, actions } = player;

  /**
   * Titlovi se preuzimaju i konvertuju pre nego sto dodju do <track> elementa —
   * tako i SRT radi, a neuspeh dobija poruku umesto tihog nestanka staze.
   */
  const { tracks: subtitleTracks, failures: subtitleFailures } = useSubtitleTracks(
    subtitles,
    videoRef,
  );
  const [idle, setIdle] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [captionSettingsOpen, setCaptionSettingsOpen] = useState(false);
  const captionSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { message: announcement, announce } = useAnnouncer();

  /**
   * Podesavanja titlova se citaju kroz `useSyncExternalStore`, a ne kroz lazy
   * `useState` initializer.
   *
   * `player-stage.tsx` cita zapamcenu poziciju lazy initializer-om i prolazi
   * nekaznjeno — ali samo zato sto je prikaz te vrednosti vezan za `state.ready`,
   * koje je pri hidrataciji `false`, pa i server i klijent renderuju `null`.
   *
   * Ovde tog izlaza NEMA: panel i inline `--kf-cc-scale`/`--kf-cc-bg` postoje
   * vec u prvom renderu, a server nema `localStorage`. `getServerSnapshot`
   * resava tacno to — server i hidratacija vide podrazumevanu vrednost, prava
   * stigne odmah posle.
   */
  const captionPrefs = useSyncExternalStore(
    subscribeCaptionPrefs,
    getCaptionPrefsSnapshot,
    getCaptionPrefsServerSnapshot,
  );

  /**
   * `saveCaptionPrefs`/`resetCaptionPrefs` sami obavestavaju pretplatnike, pa
   * novo stanje stize nazad kroz `useSyncExternalStore` — nema drugog izvora
   * istine, i nema potrebe za lokalnim `setState`.
   *
   * BEZ `announce()` ovde, za razliku od ostalih kontrola: sve ovo su klizaci
   * i color input-i unutar modala koji se aktivno prevlace, pa bi svaka
   * promena zatrpala zivi region. Svaki kontrol u modalu nosi svoj
   * `aria-label`/`aria-valuetext`, sto citacu ekrana vec daje trenutnu
   * vrednost pri fokusu — isto pravilo kao klizac za zvuk.
   */
  const onCaptionPrefsChange = useCallback((patch: Partial<CaptionPrefs>) => {
    saveCaptionPrefs(patch);
  }, []);

  const onResetCaptionPrefs = useCallback(() => {
    resetCaptionPrefs();
  }, []);

  const closeCaptionSettings = useCallback(() => setCaptionSettingsOpen(false), []);

  /**
   * Vidljivost se IZVODI, ne drži u zasebnom stanju: na pauzi su kontrole uvek
   * tu, a dok svira zavise od mirovanja. Da se pauza rešava `setState`-om u
   * efektu, svaki play/pause bi izazvao dodatni render.
   *
   * `hasFocusWithin` je tu zbog pristupacnosti: kontrole se NIKAD ne gase dok je
   * fokus u njima. Bez toga bi korisniku tastature fokus ostao na dugmetu koje
   * se u medjuvremenu ugasilo, a `inert` ispod bi mu ga oteo.
   *
   * `captionSettingsOpen` je iz istog razloga: modal je van `inert` omotaca
   * (portal je direktno dete kontejnera, vidi JSX ispod), pa bez ovoga bi se
   * kontrole ispod njega mogle stopiti dok korisnik jos bira boju.
   */
  const controlsVisible = !state.playing || !idle || hasFocusWithin || captionSettingsOpen;

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setIdle(true), CONTROLS_HIDE_MS);
  }, []);

  /** Interakcija — pokaži kontrole i počni odbrojavanje ispočetka. */
  const revealControls = useCallback(() => {
    setIdle(false);
    scheduleHide();
  }, [scheduleHide]);

  // Odbrojavanje teče samo dok video svira i modal nije otvoren; u oba
  // suprotna slucaja se poništava.
  useEffect(() => {
    if (!state.playing || captionSettingsOpen) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }

    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [state.playing, captionSettingsOpen, scheduleHide]);

  // Play/pause se izvodi iz stanja, a ne iz akcije — tako jedna objava pokriva
  // i dugme, i razmak, i klik na sliku, i ne moze da se razidje sa elementom.
  useAnnounceOnChange(state.playing, state.playing ? "Reprodukcija" : "Pauzirano", announce);
  useAnnounceOnChange(state.muted, state.muted ? "Zvuk isključen" : "Zvuk uključen", announce);
  useAnnounceOnChange(
    state.activeTextTrack >= 0,
    state.activeTextTrack >= 0 ? "Titlovi uključeni" : "Titlovi isključeni",
    announce,
  );
  useAnnounceOnChange(state.playbackRate, `Brzina ${state.playbackRate}×`, announce);
  // Velicina titlova se objavljuje iz svog handlera — vidi `onCaptionScaleChange`.

  /**
   * Ponuda za nastavak se pojavljuje SAMA, bez korisnikovog gesta (vidi
   * `resume-prompt.tsx`), pa citac ekrana inace ne bi imao odakle da zna da
   * se nesto pojavilo — nema fokusa koji bi mu to otkrio. Okidac je
   * `resumePromptSeconds != null`, ne sam broj: pozicija se ne menja dok je
   * ponuda prikazana, pa bi drugaciji okidac bio no-op, ali eksplicitna
   * bool-provera cita jasnije.
   */
  useAnnounceOnChange(
    resumePromptSeconds != null,
    resumePromptSeconds != null
      ? `Ponuda: nastavi gledanje od ${formatTime(resumePromptSeconds)}`
      : null,
    announce,
  );

  // Pozicija se objavljuje tek kad premotavanje slegne, sa odlaganjem — vidi
  // `POSITION_ANNOUNCE_DELAY_MS`. Prevlacenje klizaca ovde NE ucestvuje: njega
  // vec pokriva `aria-valuetext` na samom klizacu, pa bi objava bila duplikat.
  useAnnounceOnChange(
    state.seeking,
    state.seeking ? null : `${formatTime(state.currentTime)} od ${formatTime(state.duration)}`,
    announce,
    POSITION_ANNOUNCE_DELAY_MS,
  );

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
          // Isti gard kao "c" ispod: fokus moze da bude na <select> za font
          // (opcija "Monospejs") u modalu za podesavanja titlova — bez garda
          // bi F usred prevlacenja klizaca u tom modalu neocekivano gasio/
          // palio fullscreen.
          if (inFormControl) return;
          actions.toggleFullscreen();
          break;
        case "m":
        case "M":
          // Isto: "M" je type-ahead precica za opciju "Monospejs" u <select>-u
          // za font — bez garda bi umesto toga utisavala zvuk.
          if (inFormControl) return;
          actions.toggleMute();
          break;
        case "c":
        case "C":
          // Gard za polja postoji jer je `c` obicno slovo — u buducem tekstualnom
          // polju unutar kontrola ne sme da se proguta.
          if (inFormControl) return;
          actions.toggleCaptions();
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
      {/*
        `crossOrigin` je OBAVEZAN, ne kozmetika: media stize sa R2, a WebVTT sa
        drugog origin-a browser cita samo u CORS modu — bez ovoga se .vtt preuzme
        ali cue-ovi ostanu prazni, bez ijedne greske u konzoli.

        Cena: atribut vazi za SVE sto element ucitava (poster, i na nativnom
        engine-u sam .m3u8), pa svaki origin sa kog se app servira mora biti u
        R2 CORS pravilima. Vidi "Titlovi" u README-u.

        Bez `default` atributa — on postavlja mod pri parsiranju i posle toga ga
        React ne kontrolise. Stanje titlova je Reactovo, primenjuje ga `usePlayer`.
      */}
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        poster={poster ?? undefined}
        aria-label={title ? `Video: ${title}` : "Video"}
        onClick={actions.togglePlay}
        className="aspect-video w-full cursor-pointer bg-black"
      >
        {subtitleTracks.map((subtitle) => (
          // kind="captions", ne "subtitles": ovo je transkripcija govora na
          // istom jeziku, a to je razlika koju oba pojma i znace.
          //
          // `src` je blob, ne originalni URL — titl je vec preuzet i, ako je
          // bio SRT, pretvoren u WebVTT. Vidi `use-subtitle-tracks.ts`.
          <track
            key={subtitle.id}
            kind="captions"
            src={subtitle.url}
            srcLang={subtitle.lang}
            label={subtitle.label}
          />
        ))}
      </video>

      {/*
        Region stoji uvek i krece prazan — zivi region ubacen u DOM zajedno sa
        svojim sadrzajem citaci cesto propuste.
      */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {state.error ? (
        <div className="text-kf-danger absolute inset-0 flex items-center justify-center p-4 text-center text-sm">
          Greška pri reprodukciji: {state.error}
        </div>
      ) : (
        <>
          <CaptionOverlay
            videoRef={videoRef}
            activeTextTrack={state.activeTextTrack}
            prefs={captionPrefs}
          />

          {overlay}

          {/*
            Neuspeo titl NE ide kroz `state.error` — ono zamenjuje ceo plejer,
            a snimak bez titla je i dalje gledljiv. Zato zasebna, nefatalna
            poruka; CC kontrola u istom slucaju ostaje onemogucena.
          */}
          {subtitleFailures.length > 0 && (
            <div
              role="status"
              className="text-kf-danger bg-kf-surface/90 absolute top-2 right-2 left-2 rounded px-3 py-2 text-xs"
            >
              {subtitleFailures.map((failure) => (
                <p key={failure.id}>
                  Titl „{failure.label}“ se nije ucitao: {failure.message}
                </p>
              ))}
            </div>
          )}

          {/*
            `inert` vadi sakrivene kontrole i iz tab redosleda i iz accessibility
            stabla. Bez njega su kontrole nevidljive ali i dalje fokusabilne —
            korisnik tastature tabuje u prazno, a citac cita ono sto se ne vidi.

            `aria-hidden` ovde NIJE zamena: ostavio bi ih fokusabilnim a skrivenim
            od citaca, sto je stanje koje WCAG izricito zabranjuje.

            Zamka ne nastaje: kontejner iznad ima tabIndex={0}, pa Tab prvo sleti
            na njega, `onFocus` pozove `revealControls`, `inert` nestane u istom
            renderu i sledeci Tab stigne do prvog dugmeta.
          */}
          <div
            data-visible={controlsVisible}
            inert={!controlsVisible}
            onFocus={() => setHasFocusWithin(true)}
            onBlur={() => setHasFocusWithin(false)}
            className="absolute inset-x-0 bottom-0 opacity-0 transition-opacity duration-200 data-[visible=true]:opacity-100"
          >
            <PlayerControls
              state={state}
              actions={actions}
              captionSettingsOpen={captionSettingsOpen}
              onOpenCaptionSettings={() => setCaptionSettingsOpen(true)}
              captionSettingsTriggerRef={captionSettingsTriggerRef}
              chapterStarts={chapterStarts}
              currentChapter={currentChapter}
            />
          </div>

          {/*
            Van `inert` omotaca iznad, namerno: modal mora da ostane
            fokusabilan i vidljiv bez obzira na stanje auto-skrivanja kontrola
            (koje smo uz to i suspendovali dok je otvoren — vidi efekat gore).
          */}
          <CaptionSettingsModal
            open={captionSettingsOpen}
            onClose={closeCaptionSettings}
            portalTarget={containerRef}
            triggerRef={captionSettingsTriggerRef}
            prefs={captionPrefs}
            onChange={onCaptionPrefsChange}
            onReset={onResetCaptionPrefs}
          />
        </>
      )}
    </div>
  );
}
