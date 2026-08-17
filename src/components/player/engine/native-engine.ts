import {
  AUTO_LEVEL,
  type EngineEvent,
  type EngineListener,
  type PlaybackEngine,
} from "./types";

/**
 * Native HLS engine — Safari (i iOS WebKit) pušta HLS direktno preko
 * `video.src`, bez hls.js. Sam bira nivoe (ABR) i ne izlaže rendition ladder
 * skripti, pa `supportsLevelSelection()` vraća false, a UI degradira na "Auto".
 *
 * Ovim je engine-specifična razlika (native vs MSE) zatvorena iza istog
 * interface-a — UI ostaje isti u oba slučaja.
 */
export function createNativeEngine(video: HTMLVideoElement, src: string): PlaybackEngine {
  const listeners = new Set<EngineListener>();
  const emit = (event: EngineEvent) => listeners.forEach((l) => l(event));

  const onError = () => {
    const message = video.error ? `media error ${video.error.code}` : "nepoznata media greška";
    emit({ type: "error", fatal: true, message });
  };
  video.addEventListener("error", onError);

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
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    },
  };
}
