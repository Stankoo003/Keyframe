import { createHlsJsEngine } from "./hls-js-engine";
import { createNativeEngine } from "./native-engine";
import type { PlaybackEngine } from "./types";

/**
 * Bira engine na osnovu mogućnosti browsera. Ovo je jedino mesto koje zna za
 * detekciju — UI samo dobije `PlaybackEngine`.
 *
 * Redosled je hls.js PRE nativnog, kako hls.js dokumentacija i propisuje:
 *
 *   `canPlayType("application/vnd.apple.mpegurl")` vraća `"maybe"` — dakle
 *   truthy string — i u Chrome-u, iako Chrome ne pušta HLS pouzdano. Provera
 *   nativne podrške prva zato salje Chrome na nativni put, gde reprodukcija
 *   pukne sa `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4).
 *
 * `Hls.isSupported()` je pouzdan: proverava da li MSE stvarno postoji.
 * Nativni engine ostaje za iOS Safari, gde MSE nema pa hls.js ne moze da radi.
 *
 * Uzgredna korist: na desktop Safariju sada radi hls.js, pa i tamo postoji
 * rucni izbor kvaliteta — nativni HLS ne izlaze listu nivoa.
 */
export async function createEngine(video: HTMLVideoElement, src: string): Promise<PlaybackEngine> {
  const { default: Hls } = await import("hls.js");

  if (Hls.isSupported()) {
    return createHlsJsEngine(video, src);
  }

  // Bez MSE (iOS Safari) — nativni HLS je jedini put.
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    return createNativeEngine(video, src);
  }

  throw new Error("HLS nije podržan u ovom browseru.");
}
