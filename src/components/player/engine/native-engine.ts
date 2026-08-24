import { logPlayerError } from "./log-error";
import { AUTO_LEVEL, type EngineEvent, type EngineListener, type PlaybackEngine } from "./types";

/** Isti budzet kao hls.js engine — vidi hls-js-engine.ts za obrazlozenje brojeva. */
const NETWORK_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000];

/**
 * `MediaError.code` vrednosti — standardni DOM API, nema hls.js-ov nivo
 * detalja (`ErrorDetails`), samo cetiri gruba koda.
 */
const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_DECODE = 3;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/**
 * Native HLS engine — Safari (i iOS WebKit) pušta HLS direktno preko
 * `video.src`, bez hls.js. Sam bira nivoe (ABR) i ne izlaže rendition ladder
 * skripti, pa `supportsLevelSelection()` vraća false, a UI degradira na "Auto".
 *
 * Nema hls.js-ovu finu kontrolu (ErrorDetails, startLoad, recoverMediaError)
 * — jedini lever je `video.load()`. Retry-with-backoff i tu ipak ima smisla:
 * `MEDIA_ERR_NETWORK` je cesto prolazan (mreza se vratila), dok
 * `MEDIA_ERR_SRC_NOT_SUPPORTED` nikad nije — nema svrhe ponavljati fetch
 * istog fajla koji browser ne ume da parsira.
 *
 * Ovim je engine-specifična razlika (native vs MSE) zatvorena iza istog
 * interface-a — UI ostaje isti u oba slučaja.
 */
export function createNativeEngine(video: HTMLVideoElement, src: string): PlaybackEngine {
  const listeners = new Set<EngineListener>();
  const emit = (event: EngineEvent) => listeners.forEach((l) => l(event));

  let networkRetryAttempt = 0;
  let decodeRetried = false;
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

  const reload = () => {
    video.src = src;
    video.load();
  };

  const scheduleNetworkRetry = () => {
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
      reason: "media error network",
    });

    const delay = NETWORK_RETRY_DELAYS_MS[attempt - 1]!;
    clearRetryTimer();
    retryTimer = setTimeout(reload, delay);

    if (!onlineListener) {
      onlineListener = () => {
        clearRetryTimer();
        reload();
      };
      window.addEventListener("online", onlineListener);
    }
  };

  const onRecovered = () => {
    if (!recovering) return;
    recovering = false;
    networkRetryAttempt = 0;
    clearRetryTimer();
    clearOnlineListener();
    emit({ type: "recovered" });
  };

  const onError = () => {
    const code = video.error?.code;
    logPlayerError({
      scope: "native",
      details: String(code ?? "unknown"),
      fatal: true,
      message: "media error",
      url: src,
    });

    if (code === MEDIA_ERR_SRC_NOT_SUPPORTED) {
      // Nema svrhe ponavljati — format/manifest nije nesto sto retry resava.
      emit({
        type: "error",
        fatal: true,
        message: "Ne mogu da učitam video. Proveri internet konekciju.",
        details: "src-not-supported",
      });
      return;
    }

    if (code === MEDIA_ERR_NETWORK) {
      scheduleNetworkRetry();
      return;
    }

    if (code === MEDIA_ERR_DECODE || code === MEDIA_ERR_ABORTED) {
      if (!decodeRetried) {
        decodeRetried = true;
        reload();
        return;
      }
    }

    emit({
      type: "error",
      fatal: true,
      message: "Došlo je do neočekivane greške u plejeru.",
      details: String(code ?? "unknown"),
    });
  };
  video.addEventListener("error", onError);

  // Oporavak posle retry-a se prepoznaje po tome da element ponovo ucita
  // podatke/krene da igra — standardni DOM eventi, isti za oba scenarija.
  const onLoadedData = () => onRecovered();
  const onPlaying = () => onRecovered();
  video.addEventListener("loadeddata", onLoadedData);
  video.addEventListener("playing", onPlaying);

  video.src = src;

  return {
    getLevels: () => [],
    getCurrentLevel: () => AUTO_LEVEL,
    setLevel: () => {
      // Native HLS ne dozvoljava ručni izbor nivoa — no-op.
    },
    supportsLevelSelection: () => false,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      listeners.clear();
      clearRetryTimer();
      clearOnlineListener();
      video.removeEventListener("error", onError);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("playing", onPlaying);
      video.removeAttribute("src");
      video.load();
    },
  };
}
