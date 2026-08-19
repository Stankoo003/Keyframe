"use client";

import { useEffect, useState } from "react";

import type { PlaybackEngine, QualityLevel } from "./engine/types";

/** ~1.3Hz — u zahtevanom opsegu 1-2Hz. */
const SAMPLE_INTERVAL_MS = 750;

/** Rolling log — stariji unosi ispadaju, overlay ne sme neograniceno da raste. */
const LOG_LIMIT = 50;

export type SwitchLogEntry = {
  id: number;
  kind: "switch";
  timestamp: number;
  from: number;
  to: number;
  /** Trigger: true = ABR odluka, false = rucni izbor korisnika. */
  auto: boolean;
};

export type StallLogEntry = {
  id: number;
  kind: "stall";
  timestamp: number;
  durationMs: number;
};

export type StatsLogEntry = SwitchLogEntry | StallLogEntry;

export type PlayerStatsSnapshot = {
  currentLevel: number;
  levels: QualityLevel[];
  /** b/s; `null` kad engine ne izlaze procenu (native HLS). */
  bandwidthEstimate: number | null;
  bufferAheadSeconds: number;
  droppedFrames: number;
  totalFrames: number;
  /** Poslednji ucitan segment; `null` dok nijedan nije stigao (ili native engine). */
  lastFragLoadMs: number | null;
  lastFragSizeBytes: number | null;
  stallCount: number;
  /** Najnoviji unos prvi. */
  log: StatsLogEntry[];
};

const EMPTY_SNAPSHOT: PlayerStatsSnapshot = {
  currentLevel: -1,
  levels: [],
  bandwidthEstimate: null,
  bufferAheadSeconds: 0,
  droppedFrames: 0,
  totalFrames: 0,
  lastFragLoadMs: null,
  lastFragSizeBytes: null,
  stallCount: 0,
  log: [],
};

/** Preuzeti opseg u kom trenutno stoji plejer — koliko je bafera ispred glave. */
function bufferAheadSeconds(video: HTMLVideoElement): number {
  const { currentTime, buffered } = video;
  for (let index = 0; index < buffered.length; index += 1) {
    if (buffered.start(index) <= currentTime && currentTime <= buffered.end(index)) {
      return buffered.end(index) - currentTime;
    }
  }
  return 0;
}

/**
 * Stats for nerds podaci — sampling i pretplate rade SAMO dok je `enabled`
 * (overlay otvoren). Van toga nema ni intervala ni listenera: merenje ne sme
 * da utice na sam playback koji meri, a throttle na ~1-2Hz drzi rad minimalnim
 * i dok je otvoren.
 */
export function usePlayerStats(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  engineRef: React.RefObject<PlaybackEngine | null>,
  enabled: boolean,
): PlayerStatsSnapshot {
  const [snapshot, setSnapshot] = useState<PlayerStatsSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!enabled) return;

    const video = videoRef.current;
    const engine = engineRef.current;

    let log: StatsLogEntry[] = [];
    let nextId = 0;
    let stallCount = 0;
    let lastLevel = engine?.getCurrentLevel() ?? -1;
    let lastFrag: { loadMs: number; sizeBytes: number } | null = null;
    let stallStart: number | null = null;

    const pushLog = (entry: Omit<SwitchLogEntry, "id"> | Omit<StallLogEntry, "id">) => {
      nextId += 1;
      log = [{ ...entry, id: nextId } as StatsLogEntry, ...log].slice(0, LOG_LIMIT);
    };

    const unsubscribeEngine = engine?.subscribe((event) => {
      if (event.type === "levelswitched") {
        pushLog({ kind: "switch", timestamp: Date.now(), from: lastLevel, to: event.level, auto: event.auto });
        lastLevel = event.level;
      } else if (event.type === "fragloaded") {
        lastFrag = { loadMs: event.loadTimeMs, sizeBytes: event.sizeBytes };
      }
    });

    /**
     * `waiting`/`playing` rade identicno za oba engine-a jer su standardni DOM
     * eventi, ne hls.js — jedini nacin da stall-detekcija radi i na Safariju.
     * Guard na `paused`/`seeking` je nuzan: oba legitimno prolaze kroz
     * "waiting" bez da je to rebuffering.
     */
    const onWaiting = () => {
      if (!video || video.paused || video.seeking) return;
      stallStart = performance.now();
    };
    const onPlaying = () => {
      if (stallStart === null) return;
      const durationMs = performance.now() - stallStart;
      stallStart = null;
      stallCount += 1;
      pushLog({ kind: "stall", timestamp: Date.now(), durationMs });
    };

    video?.addEventListener("waiting", onWaiting);
    video?.addEventListener("playing", onPlaying);

    const tick = () => {
      if (!video) return;
      const quality =
        typeof video.getVideoPlaybackQuality === "function" ? video.getVideoPlaybackQuality() : null;

      setSnapshot({
        currentLevel: engine?.getCurrentLevel() ?? -1,
        levels: engine?.getLevels() ?? [],
        bandwidthEstimate: engine?.getBandwidthEstimate() ?? null,
        bufferAheadSeconds: bufferAheadSeconds(video),
        droppedFrames: quality?.droppedVideoFrames ?? 0,
        totalFrames: quality?.totalVideoFrames ?? 0,
        lastFragLoadMs: lastFrag?.loadMs ?? null,
        lastFragSizeBytes: lastFrag?.sizeBytes ?? null,
        stallCount,
        log,
      });
    };

    tick();
    const interval = setInterval(tick, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      unsubscribeEngine?.();
      video?.removeEventListener("waiting", onWaiting);
      video?.removeEventListener("playing", onPlaying);
      setSnapshot(EMPTY_SNAPSHOT);
    };
  }, [enabled, videoRef, engineRef]);

  return snapshot;
}
