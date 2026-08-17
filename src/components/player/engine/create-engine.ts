import { createHlsJsEngine } from "./hls-js-engine";
import { createNativeEngine } from "./native-engine";
import type { PlaybackEngine } from "./types";

/**
 * Bira engine na osnovu mogućnosti browsera. Ovo je jedino mesto koje zna za
 * detekciju — UI samo dobije `PlaybackEngine`.
 *
 * Redosled je nameran:
 *  1. Native HLS (Safari/iOS) ima prednost — najniža potrošnja, hardverski dekod.
 *  2. Inače hls.js (Chrome/Firefox/Edge) preko MSE.
 *  3. Nijedan → fatalna greška.
 */
export async function createEngine(
  video: HTMLVideoElement,
  src: string,
): Promise<PlaybackEngine> {
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    return createNativeEngine(video, src);
  }

  const { default: Hls } = await import("hls.js");
  if (Hls.isSupported()) {
    return createHlsJsEngine(video, src);
  }

  throw new Error("HLS nije podržan u ovom browseru.");
}
