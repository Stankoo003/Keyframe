"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SEEK_END_EPSILON_SECONDS } from "./constants";
import { createEngine } from "./engine/create-engine";
import { AUTO_LEVEL, type PlaybackEngine, type QualityLevel } from "./engine/types";

/** Jedan neprekidan opseg koji je vec preuzet. */
export type BufferedRange = { start: number; end: number };

/** Sve što UI kontrolama treba da renderuju stanje plejera. */
export type PlayerState = {
  ready: boolean;
  playing: boolean;
  seeking: boolean;
  currentTime: number;
  duration: number;
  /** SVI preuzeti opsezi, ne samo poslednji — posle premotavanja ih ima vise. */
  bufferedRanges: BufferedRange[];
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  levels: QualityLevel[];
  currentLevel: number;
  supportsLevelSelection: boolean;
  error: string | null;
};

/** Akcije koje UI zove; ne otkrivaju ni <video> ni engine. */
export type PlayerActions = {
  togglePlay: () => void;
  seek: (time: number) => void;
  /** Pomeri za `delta` sekundi, sa clamp-om na [0, duration]. */
  skip: (delta: number) => void;
  setVolume: (volume: number) => void;
  /** Promeni jacinu za `delta`, sa clamp-om na [0, 1]. */
  nudgeVolume: (delta: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  selectLevel: (index: number) => void;
  toggleFullscreen: () => void;
};

const INITIAL: PlayerState = {
  ready: false,
  playing: false,
  seeking: false,
  currentTime: 0,
  duration: 0,
  bufferedRanges: [],
  volume: 1,
  muted: false,
  playbackRate: 1,
  fullscreen: false,
  levels: [],
  currentLevel: AUTO_LEVEL,
  supportsLevelSelection: false,
  error: null,
};

/** Ogranici vrednost na [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Najveca pozicija na koju se sme premotati.
 *
 * `duration` se u HLS-u precizira dok segmenti stizu (28 → 28.0107), pa se cita
 * iz elementa u trenutku premotavanja, a ne kesira.
 */
function maxSeekTarget(video: HTMLVideoElement): number {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, duration - SEEK_END_EPSILON_SECONDS);
}

/** Procita sve preuzete opsege iz medija elementa. */
function readBufferedRanges(video: HTMLVideoElement): BufferedRange[] {
  return Array.from({ length: video.buffered.length }, (_, index) => ({
    start: video.buffered.start(index),
    end: video.buffered.end(index),
  }));
}

/**
 * Veže <video> element i `PlaybackEngine` u reaktivno React stanje.
 *
 * Transport (play/seek/volume/fullscreen) čita se iz DOM-a i piše na <video>
 * direktno — to nije HLS-specifično. Engine se koristi samo za rendition ladder
 * i fatalne greške. Time kontrole ostaju iste bez obzira koji engine vozi.
 */
export function usePlayer(src: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  /**
   * Poslednja TRAZENA pozicija, dok seek jos nije slegao.
   *
   * Bez ovoga se brzi uzastopni pritisci gube: svaki bi racunao od
   * `video.currentTime`, koji se jos nije pomerio, pa bi svih pet dalo isti cilj.
   */
  const pendingSeekRef = useRef<number | null>(null);
  const [state, setState] = useState<PlayerState>(INITIAL);

  /**
   * Lanac kroz koji se kreiranje engine-a serijalizuje.
   *
   * `createEngine` je asinhron (dinamicki `import("hls.js")`). Bez lanca, Strict
   * Mode montira efekat dvaput pa se drugi engine zakaci na isti <video> dok
   * prvi jos nastaje; kad se prvi promise razresi, njegov `destroy()` otkine
   * MediaSource drugome — slika stoji, `duration` ostane 0.
   *
   * Isto se desi i kad se `src` promeni brze nego sto engine stigne da nastane,
   * pa ovo nije samo dev-problem.
   */
  const setupChainRef = useRef<Promise<void>>(Promise.resolve());

  const patch = useCallback((partial: Partial<PlayerState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Kreiranje/uništavanje engine-a uz promenu izvora.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    // Drzimo i lokalno: cleanup mora da moze da unisti engine i pre nego sto
    // stigne u `engineRef`.
    let engine: PlaybackEngine | null = null;

    setState(INITIAL);

    const setup = setupChainRef.current.then(async () => {
      if (disposed) return;

      try {
        const created = await createEngine(video, src);

        if (disposed) {
          created.destroy();
          return;
        }

        engine = created;
        engineRef.current = created;

        patch({
          ready: true,
          supportsLevelSelection: created.supportsLevelSelection(),
          currentLevel: created.getCurrentLevel(),
        });

        created.subscribe((event) => {
          if (event.type === "levels") patch({ levels: event.levels });
          else if (event.type === "levelswitched") patch({ currentLevel: event.level });
          else if (event.type === "error") patch({ error: event.message });
          // "fragloaded" ne dodiruje PlayerState — Stats overlay se pretplacuje
          // direktno na engine, vidi use-player-stats.ts.
        });
      } catch (err: unknown) {
        if (!disposed) patch({ error: err instanceof Error ? err.message : String(err) });
      }
    });

    setupChainRef.current = setup;

    return () => {
      disposed = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, [src, patch]);

  // Pretplata na <video> DOM evente za transport-stanje.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncTime = () => {
      patch({ currentTime: video.currentTime, bufferedRanges: readBufferedRanges(video) });
    };
    const syncMeta = () =>
      patch({ duration: Number.isFinite(video.duration) ? video.duration : 0 });
    const syncPlay = () => patch({ playing: !video.paused });
    const syncVolume = () => patch({ volume: video.volume, muted: video.muted });
    const syncRate = () => patch({ playbackRate: video.playbackRate });

    const onSeeking = () => patch({ seeking: true });
    const onSeeked = () => {
      // Seek je sleteo — sledece preskakanje krece od stvarne pozicije.
      pendingSeekRef.current = null;
      patch({
        seeking: false,
        currentTime: video.currentTime,
        bufferedRanges: readBufferedRanges(video),
      });
    };

    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("progress", syncTime);
    video.addEventListener("durationchange", syncMeta);
    video.addEventListener("loadedmetadata", syncMeta);
    video.addEventListener("play", syncPlay);
    video.addEventListener("pause", syncPlay);
    video.addEventListener("volumechange", syncVolume);
    video.addEventListener("ratechange", syncRate);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("timeupdate", syncTime);
      video.removeEventListener("progress", syncTime);
      video.removeEventListener("durationchange", syncMeta);
      video.removeEventListener("loadedmetadata", syncMeta);
      video.removeEventListener("play", syncPlay);
      video.removeEventListener("pause", syncPlay);
      video.removeEventListener("volumechange", syncVolume);
      video.removeEventListener("ratechange", syncRate);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [patch]);

  // Fullscreen stanje prati document, jer korisnik može izaći Esc-om.
  useEffect(() => {
    const onFsChange = () => patch({ fullscreen: document.fullscreenElement != null });
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [patch]);

  const actions: PlayerActions = {
    togglePlay: useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        // play() vraca Promise koji se odbija sa AbortError kad ga pauza pretekne
        // pre nego sto reprodukcija stigne da krene. To je ocekivano — korisnikova
        // kasnija akcija je pobedila. Sve ostalo pustamo dalje da se ne izgubi.
        video.play().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          throw error;
        });
      } else {
        video.pause();
      }
    }, []),
    seek: useCallback((time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const target = clamp(time, 0, maxSeekTarget(video));
      pendingSeekRef.current = target;
      video.currentTime = target;
    }, []),

    /**
     * Preskakanje koje se SABIRA pri brzim uzastopnim pritiscima.
     *
     * Osnova je `pendingSeekRef`, ne `video.currentTime`: dok seek jos traje,
     * element moze i dalje prijavljivati staru poziciju, pa bi pet brzih
     * pritisaka sletelo na +5s umesto na +25s. Ref se brise na `seeked`.
     */
    skip: useCallback(
      (delta: number) => {
        const video = videoRef.current;
        if (!video) return;

        const base = pendingSeekRef.current ?? video.currentTime;
        const target = clamp(base + delta, 0, maxSeekTarget(video));

        pendingSeekRef.current = target;
        video.currentTime = target;
        // Odmah osvezi prikaz; `timeupdate` stigne tek kad seek slegne.
        patch({ currentTime: target });
      },
      [patch],
    ),

    setVolume: useCallback((volume: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = clamp(volume, 0, 1);
      if (volume > 0) video.muted = false;
    }, []),
    /** `delta` je vec potpisan korak, npr. `+VOLUME_STEP` ili `-VOLUME_STEP`. */
    nudgeVolume: useCallback((delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = clamp(video.volume + delta, 0, 1);
      video.volume = next;
      if (next > 0) video.muted = false;
    }, []),
    toggleMute: useCallback(() => {
      if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
    }, []),

    /**
     * Brzina ostaje na elementu i prezivljava pauzu, play i premotavanje —
     * `playbackRate` se ne resetuje ni na jedan od njih. Stanje se sinhronizuje
     * kroz `ratechange`, pa UI ne moze da se razidje sa elementom.
     */
    setPlaybackRate: useCallback((rate: number) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
    }, []),

    selectLevel: useCallback((index: number) => {
      engineRef.current?.setLevel(index);
    }, []),
    toggleFullscreen: useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void container.requestFullscreen();
    }, []),
  };

  return { videoRef, containerRef, state, actions, engineRef };
}
