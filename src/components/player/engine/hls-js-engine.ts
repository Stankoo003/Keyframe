import type Hls from "hls.js";
import type { ErrorData, HlsConfig } from "hls.js";

import { logPlayerError } from "./log-error";
import {
  AUTO_LEVEL,
  type EngineEvent,
  type EngineListener,
  type PlaybackEngine,
  type QualityLevel,
} from "./types";

/**
 * Koliko puta app-level petlja pokusava `hls.startLoad()` posle fatalnog
 * mreznog prekida, i sa kojim razmakom. hls.js sam vec ima interni
 * retry-with-backoff (vidi `config` nize) — ovo je DRUGI sloj, za slucaj kad
 * je i taj budzet potrosen (npr. stvarni prekid konekcije od par desetina
 * sekundi). Rastuci razmak = exponential backoff; ~60s ukupnog budzeta je
 * dovoljno za tipican wifi/mobilni prekid, a ne ostavlja korisnika da ceka
 * vecno pre nego sto vidi jasnu gresku.
 */
const NETWORK_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000];

/** Koliko puta se pokusava `recoverMediaError()` pre nego sto se odustane. */
const MAX_MEDIA_ERROR_RETRIES = 3;

const LEVEL_RELATED_DETAILS = new Set<string>([
  "levelLoadError",
  "levelLoadTimeOut",
  "levelEmptyError",
  "levelParsingError",
]);

const MANIFEST_RELATED_DETAILS = new Set<string>([
  "manifestLoadError",
  "manifestLoadTimeOut",
  "manifestParsingError",
]);

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
    /**
     * Retry-with-backoff — PRVI sloj odbrane, u potpunosti unutar hls.js-a.
     * hls.js sam duplira razmak do max-a; nista od ovoga ne dopire do naseg
     * ERROR listenera dok se ne potrosi.
     *
     * NAMERNO skraceno na ~5s ukupnog budzeta (umesto ~20-30s) — demo-friendly
     * podesavanje, da se "recovering" baner (drugi sloj, `scheduleNetworkRetry`)
     * pojavi brzo kad se mreza ugasi kroz DevTools, bez cekanja pola minuta.
     * Kod stvarno neravnog terena (mobilni prekidi od par sekundi) ovo znaci da
     * eskalacija u fatalno ide ranije nego pre — prihvatljivo za demo, ali pre
     * produkcije vratiti na sire budzete (manifest 8s / level 16s / frag 16s).
     */
    manifestLoadingMaxRetry: 2,
    manifestLoadingRetryDelay: 1000,
    manifestLoadingMaxRetryTimeout: 3000,
    levelLoadingMaxRetry: 3,
    levelLoadingRetryDelay: 500,
    levelLoadingMaxRetryTimeout: 3000,
    fragLoadingMaxRetry: 4,
    fragLoadingRetryDelay: 300,
    fragLoadingMaxRetryTimeout: 2000,
  };
  const hls: Hls = new HlsCtor(config);

  let levels: QualityLevel[] = [];
  const excludedLevels = new Set<number>();

  let networkRetryAttempt = 0;
  let mediaRetryAttempt = 0;
  let recovering = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let onlineListener: (() => void) | null = null;

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const clearOnlineListener = () => {
    if (onlineListener) {
      window.removeEventListener("online", onlineListener);
      onlineListener = null;
    }
  };

  /** Prvi dostupan (ne-iskljucen) nivo — preferira sledeci NIZI od `from`. */
  const pickFallbackLevel = (from: number): number | null => {
    const available = levels
      .map((level) => level.index)
      .filter((index) => !excludedLevels.has(index));
    if (available.length === 0) return null;

    const lower = available.filter((index) => index < from).sort((a, b) => b - a);
    if (lower.length > 0) return lower[0]!;

    return available.sort((a, b) => a - b)[0]!;
  };

  /** Iskljuci nivo (pokvaren/nedostupan) i pomeri se na drugi ako je trenutno aktivan. */
  const excludeLevel = (levelIndex: number, reason: string) => {
    if (excludedLevels.has(levelIndex)) return null; // vec obradjeno — ne dupliraj degraded

    excludedLevels.add(levelIndex);
    levels = levels.filter((level) => level.index !== levelIndex);
    emit({ type: "levels", levels });

    const fallback = pickFallbackLevel(levelIndex);
    if (fallback !== null && hls.currentLevel === levelIndex) {
      hls.currentLevel = fallback;
    }
    if (fallback !== null) {
      emit({ type: "degraded", excludedLevel: levelIndex, toLevel: fallback, reason });
    }
    return fallback;
  };

  /** Zakaze sledeci pokusaj oporavka mreznog prekida, sa backoff razmakom. */
  const scheduleNetworkRetry = (reason: string) => {
    if (networkRetryAttempt >= NETWORK_RETRY_DELAYS_MS.length) {
      clearOnlineListener();
      emit({
        type: "error",
        fatal: true,
        message: "Veza je prekinuta i nije se oporavila. Proveri konekciju i pokušaj ponovo.",
        details: "network-retry-exhausted",
      });
      return;
    }

    recovering = true;
    networkRetryAttempt += 1;
    const attempt = networkRetryAttempt;
    emit({
      type: "recovering",
      attempt,
      maxAttempts: NETWORK_RETRY_DELAYS_MS.length,
      reason,
    });

    const delay = NETWORK_RETRY_DELAYS_MS[attempt - 1]!;
    clearRetryTimer();
    retryTimer = setTimeout(() => {
      hls.startLoad();
    }, delay);

    // `online` NIJE pouzdan sam za sebe (prati interfejs, ne stvarnu
    // dostupnost) — koristi se samo kao PREČICA za brzi dodatni pokusaj,
    // petlja iznad radi i bez njega.
    if (!onlineListener) {
      onlineListener = () => {
        clearRetryTimer();
        hls.startLoad();
      };
      window.addEventListener("online", onlineListener);
    }
  };

  const onRecoveringSuccess = () => {
    if (!recovering) return;
    recovering = false;
    networkRetryAttempt = 0;
    clearRetryTimer();
    clearOnlineListener();
    emit({ type: "recovered" });
  };

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
    // Odbrana: ako nesto (ABR ili rucni izbor) ipak pokusa da izabere
    // vec-iskljuceni nivo, odmah ga preusmeri — ne emituj switch ka njemu.
    if (excludedLevels.has(data.level)) {
      const fallback = pickFallbackLevel(data.level);
      if (fallback !== null) hls.nextLevel = fallback;
      return;
    }
    emit({
      type: "levelswitched",
      level: hls.autoLevelEnabled ? AUTO_LEVEL : data.level,
      actualLevel: data.level,
      auto: hls.autoLevelEnabled,
    });
  });

  hls.on(HlsCtor.Events.FRAG_LOADED, (_e, data) => {
    mediaRetryAttempt = 0;
    onRecoveringSuccess();

    // Isti dogadjaj hrani i Stats overlay: uspesno ucitan fragment je i dokaz
    // oporavka i jedini izvor stvarnog fetch vremena.
    const { loading } = data.frag.stats;
    emit({
      type: "fragloaded",
      level: data.frag.level,
      loadTimeMs: loading.end - loading.start,
      sizeBytes: data.frag.stats.loaded,
      durationS: data.frag.duration,
    });
  });
  hls.on(HlsCtor.Events.LEVEL_LOADED, () => {
    onRecoveringSuccess();
  });

  hls.on(HlsCtor.Events.ERROR, (_e, data: ErrorData) => {
    /**
     * Na LEVEL_LOAD_ERROR/TIMEOUT hls.js NE popunjava `data.level` — nivo je
     * u `data.context.level` (vidi playlist-loader u hls.js izvoru). Za
     * FRAG_LOAD_ERROR `data.level` JESTE popunjen direktno. Bez ovog
     * fallback-a `excludeLevel` nikad ne bi dobio validan indeks za level-load
     * greske i pokvaren rendition bi ostao vidljiv u <select>-u.
     */
    const levelIndex = data.level ?? data.context?.level ?? undefined;

    logPlayerError({
      scope: "hls",
      type: data.type,
      details: data.details,
      fatal: data.fatal,
      level: levelIndex,
      attempt:
        data.fatal && data.type === HlsCtor.ErrorTypes.NETWORK_ERROR
          ? networkRetryAttempt
          : undefined,
      message: data.fatal ? "fatalna greška" : "ne-fatalna greška (hls.js interno rešava)",
      url: data.url ?? data.frag?.url,
    });

    // Ne-fatalno: hls.js vec sam interno prebacuje na drugi nivo/ponavlja
    // fetch, ali BEZ ikakvog vidljivog signala korisniku — zato ovde ipak
    // (jednokratno, po nivou) oznacavamo pokvaren rendition kao iskljucen.
    if (!data.fatal) {
      if (LEVEL_RELATED_DETAILS.has(data.details) && levelIndex !== undefined) {
        excludeLevel(levelIndex, data.details);
      }
      return;
    }

    if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
      if (MANIFEST_RELATED_DETAILS.has(data.details)) {
        // Neoporavivo po definiciji zahteva — nema playliste, nema reprodukcije.
        emit({
          type: "error",
          fatal: true,
          message: "Ne mogu da učitam video. Proveri internet konekciju.",
          details: data.details,
        });
        return;
      }

      if (LEVEL_RELATED_DETAILS.has(data.details) && levelIndex !== undefined) {
        const fallback = excludeLevel(levelIndex, data.details);
        if (fallback === null) {
          emit({
            type: "error",
            fatal: true,
            message: "Nijedan kvalitet snimka trenutno nije dostupan.",
            details: "all-levels-excluded",
          });
        }
        return;
      }

      // Opsti mrezni prekid (npr. FRAG_LOAD_ERROR eskalirano u fatalno, ili
      // potpun gubitak konekcije) — "network drop mid-playback".
      scheduleNetworkRetry(data.details);
      return;
    }

    if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
      mediaRetryAttempt += 1;
      if (mediaRetryAttempt <= MAX_MEDIA_ERROR_RETRIES) {
        if (mediaRetryAttempt > 1) hls.swapAudioCodec();
        hls.recoverMediaError();
        return;
      }
      emit({
        type: "error",
        fatal: true,
        message: "Došlo je do neočekivane greške u plejeru.",
        details: data.details,
      });
      return;
    }

    // KEY_SYSTEM_ERROR, MUX_ERROR, OTHER_ERROR — nije smisleno oporaviti na app nivou.
    emit({
      type: "error",
      fatal: true,
      message: "Došlo je do neočekivane greške u plejeru.",
      details: data.details,
    });
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
      clearRetryTimer();
      clearOnlineListener();
      hls.destroy();
    },
  };
}
