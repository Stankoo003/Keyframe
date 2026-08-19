/**
 * Citanje tekstualnih staza sa <video> elementa.
 *
 * Zaseban modul jer ga dele `usePlayer` (koji odrzava listu staza i njihov mod)
 * i `CaptionOverlay` (koji iz aktivne staze cita cue-ove). Bez ovoga bi jedan
 * uvozio drugog samo zbog jedne funkcije.
 */

/**
 * Procita tekstualne staze KROZ DOM, a ne iz `video.textTracks`.
 *
 * Razlika je bitna: hls.js radi sa `renderTextTracksNatively`, pa ume da
 * napravi native `TextTrack` za CEA-608/708 kanal koji zatekne u streamu.
 * Takva staza nema svoj <track> element, pa bi indeksiranje `video.textTracks`
 * umelo da uhvati fantomski "CC1" umesto naseg titla.
 */
export function readTextTracks(
  video: HTMLVideoElement,
): { el: HTMLTrackElement; track: TextTrack }[] {
  return Array.from(video.querySelectorAll("track")).flatMap((el) =>
    el.track ? [{ el, track: el.track }] : [],
  );
}
