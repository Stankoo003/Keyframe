"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createEngine } from "./engine/create-engine";
import { AUTO_LEVEL, type PlaybackEngine, type QualityLevel } from "./engine/types";

/** Sve što UI kontrolama treba da renderuju stanje plejera. */
export type PlayerState = {
  ready: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
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
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  selectLevel: (index: number) => void;
  toggleFullscreen: () => void;
};

const INITIAL: PlayerState = {
  ready: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  muted: false,
  fullscreen: false,
  levels: [],
  currentLevel: AUTO_LEVEL,
  supportsLevelSelection: false,
  error: null,
};

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
  const [state, setState] = useState<PlayerState>(INITIAL);

  const patch = useCallback((partial: Partial<PlayerState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // Kreiranje/uništavanje engine-a uz promenu izvora.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    setState(INITIAL);

    createEngine(video, src)
      .then((engine) => {
        if (disposed) {
          engine.destroy();
          return;
        }
        engineRef.current = engine;
        patch({
          ready: true,
          supportsLevelSelection: engine.supportsLevelSelection(),
          currentLevel: engine.getCurrentLevel(),
        });

        engine.subscribe((event) => {
          if (event.type === "levels") patch({ levels: event.levels });
          else if (event.type === "levelswitched") patch({ currentLevel: event.level });
          else if (event.type === "error") patch({ error: event.message });
        });
      })
      .catch((err: unknown) => {
        if (!disposed) patch({ error: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      disposed = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [src, patch]);

  // Pretplata na <video> DOM evente za transport-stanje.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncTime = () => {
      const buffered =
        video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
      patch({ currentTime: video.currentTime, buffered });
    };
    const syncMeta = () => patch({ duration: Number.isFinite(video.duration) ? video.duration : 0 });
    const syncPlay = () => patch({ playing: !video.paused });
    const syncVolume = () => patch({ volume: video.volume, muted: video.muted });

    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("progress", syncTime);
    video.addEventListener("durationchange", syncMeta);
    video.addEventListener("loadedmetadata", syncMeta);
    video.addEventListener("play", syncPlay);
    video.addEventListener("pause", syncPlay);
    video.addEventListener("volumechange", syncVolume);

    return () => {
      video.removeEventListener("timeupdate", syncTime);
      video.removeEventListener("progress", syncTime);
      video.removeEventListener("durationchange", syncMeta);
      video.removeEventListener("loadedmetadata", syncMeta);
      video.removeEventListener("play", syncPlay);
      video.removeEventListener("pause", syncPlay);
      video.removeEventListener("volumechange", syncVolume);
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
      if (video.paused) void video.play();
      else video.pause();
    }, []),
    seek: useCallback((time: number) => {
      if (videoRef.current) videoRef.current.currentTime = time;
    }, []),
    setVolume: useCallback((volume: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = volume;
      if (volume > 0) video.muted = false;
    }, []),
    toggleMute: useCallback(() => {
      if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
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

  return { videoRef, containerRef, state, actions };
}
