import type Hls from "hls.js";
import type { HlsConfig } from "hls.js";

import {
  AUTO_LEVEL,
  type EngineEvent,
  type EngineListener,
  type PlaybackEngine,
  type QualityLevel,
} from "./types";

/**
 * hls.js implementacija engine-a — koristi se u Chrome/Firefox/Edge, gde nema
 * nativnog HLS-a. hls.js sam radi MSE (Media Source Extensions) i ABR.
 *
 * hls.js referencira `window`, pa se učitava dinamički (`await import`) tek u
 * browseru; ovako ne ulazi u početni bundle niti puca u SSR-u.
 */
export async function createHlsJsEngine(
  video: HTMLVideoElement,
  src: string,
): Promise<PlaybackEngine> {
  const { default: HlsCtor } = await import("hls.js");

  const listeners = new Set<EngineListener>();
  const emit = (event: EngineEvent) => listeners.forEach((l) => l(event));

  const config: Partial<HlsConfig> = {
    // Podrazumevani ABR je dovoljan; ladder je već keyframe-poravnat pri enkodu.
    enableWorker: true,
  };
  const hls: Hls = new HlsCtor(config);

  let levels: QualityLevel[] = [];

  hls.on(HlsCtor.Events.MANIFEST_PARSED, (_e, data) => {
    levels = data.levels.map((level, index) => ({
      index,
      height: level.height ?? 0,
      bitrate: level.bitrate ?? 0,
      label: level.height ? `${level.height}p` : `${Math.round((level.bitrate ?? 0) / 1000)}k`,
    }));
    emit({ type: "levels", levels });
  });

  /**
   * `LEVEL_SWITCHING`, ne `LEVEL_SWITCHED`: potonji prati STVARNO ODIGRAN
   * fragment (vidi `checkFragmentChanged` u hls.js), pa kod velikog vec-baferovanog
   * sadrzaja moze da kasni desetinama sekundi za rucnim izborom — <select> bi
   * tiho "otkazao" izbor sve dok playback stvarno ne stigne do novog nivoa.
   * `LEVEL_SWITCHING` prati ODLUKU (rucnu ili ABR), sto je i UI-u i Stats
   * overlay-u potrebno da odmah odrazi izbor.
   */
  hls.on(HlsCtor.Events.LEVEL_SWITCHING, (_e, data) => {
    emit({
      type: "levelswitched",
      level: hls.autoLevelEnabled ? AUTO_LEVEL : data.level,
      actualLevel: data.level,
      auto: hls.autoLevelEnabled,
    });
  });

  hls.on(HlsCtor.Events.FRAG_LOADED, (_e, data) => {
    const { loading } = data.frag.stats;
    emit({
      type: "fragloaded",
      level: data.frag.level,
      loadTimeMs: loading.end - loading.start,
      sizeBytes: data.frag.stats.loaded,
      durationS: data.frag.duration,
    });
  });

  hls.on(HlsCtor.Events.ERROR, (_e, data) => {
    if (data.fatal) {
      emit({ type: "error", fatal: true, message: `${data.type}: ${data.details}` });
    }
  });

  hls.attachMedia(video);
  hls.loadSource(src);

  return {
    getLevels: () => levels,
    getCurrentLevel: () => (hls.autoLevelEnabled ? AUTO_LEVEL : hls.currentLevel),
    getActualLevel: () => hls.currentLevel,
    setLevel: (index: number) => {
      // -1 vraća hls.js na automatski ABR; inače fiksira nivo.
      hls.currentLevel = index;
    },
    supportsLevelSelection: () => true,
    getBandwidthEstimate: () => hls.bandwidthEstimate ?? null,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      listeners.clear();
      hls.destroy();
    },
  };
}
