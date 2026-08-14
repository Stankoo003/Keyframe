/**
 * Gradnja URL-ova ka media fajlovima.
 *
 * Nijedan apsolutni media URL ne sme da stoji u kodu ili seed podacima — sve
 * ide kroz `mediaUrl()`, da bi lokalno i deploy-ovano okruzenje mogli da gadjaju
 * razlicite izvore bez ijedne izmene u kodu.
 *
 * NEXT_PUBLIC_ prefiks je obavezan: plejer je klijentska komponenta, pa vrednost
 * mora da stigne do browsera. Next je ugradjuje u bundle tokom build-a.
 *
 * Prazna vrednost = serviraj lokalno iz public/ (relativni URL-ovi).
 */

const RAW_BASE = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "";

/** Base URL bez zavrsne kose crte. Prazan string znaci "isti origin". */
export const MEDIA_BASE_URL = RAW_BASE.replace(/\/+$/, "");

/**
 * Pravi URL ka media fajlu.
 *
 * @example
 * mediaUrl("hls/clip-01-bars/master.m3u8")
 * // lokalno   → "/media/hls/clip-01-bars/master.m3u8"
 * // sa CDN-om → "https://pub-xxx.r2.dev/hls/clip-01-bars/master.m3u8"
 */
export function mediaUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return MEDIA_BASE_URL ? `${MEDIA_BASE_URL}/${clean}` : `/media/${clean}`;
}

/** URL master playliste za dati klip. */
export function masterPlaylistUrl(clip: string): string {
  return mediaUrl(`hls/${clip}/master.m3u8`);
}

/** true kad se media servira sa CDN-a umesto lokalno iz public/. */
export const isUsingCdn = MEDIA_BASE_URL !== "";
