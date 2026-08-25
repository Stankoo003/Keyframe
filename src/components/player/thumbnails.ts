/**
 * Mapa sličica za seek traku (`thumbs.jpg` + `thumbs.vtt`, iz `scripts/encode.sh`).
 *
 * Cist modul bez DOM-a i bez React-a, kao `subtitle-source.ts` — testira se
 * direktno, bez browsera i bez pravog strima.
 *
 * Format cue-a je de-facto standard koji koriste i drugi plejeri:
 *
 *   00:00:12.000 --> 00:00:14.000
 *   thumbs.jpg#xywh=320,90,160,90
 *
 * Namerno se NE ucitava kao `<track kind="metadata">`: `text-tracks.ts` cita
 * `<track>` elemente iz DOM-a, pa bi se sprite pojavio u listi titlova kao
 * lazan izbor. Fetch + parsiranje ovde to izbegava u celosti.
 */

import { parseTimestamp } from "./subtitle-source";

export type ThumbnailCue = {
  start: number;
  end: number;
  /** Apsolutni URL sprite-a, razresen u odnosu na URL `.vtt` fajla. */
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Razresava putanju iz cue-a u odnosu na URL `.vtt` fajla.
 *
 * `new URL(x, base)` trazi apsolutan base, a lokalno base JESTE relativan
 * (`/media/hls/.../thumbs.vtt` — vidi `mediaUrl()`). Zato se u tom slucaju
 * podmetne lazan origin i posle skine, cime relativan ulaz daje relativan
 * izlaz. Sa CDN-om je base apsolutan i ovo se svodi na obican `new URL`.
 */
function resolveAgainst(path: string, baseUrl: string): string | null {
  const PLACEHOLDER = "http://thumbnails.invalid";
  const relativeBase = !/^[a-z][a-z0-9+.-]*:/i.test(baseUrl);

  try {
    const base = new URL(baseUrl, relativeBase ? PLACEHOLDER : undefined);
    const resolved = new URL(path, base);

    return relativeBase ? resolved.href.slice(PLACEHOLDER.length) : resolved.href;
  } catch {
    return null;
  }
}

const XYWH = /#xywh=(\d+),(\d+),(\d+),(\d+)\s*$/;

/**
 * Politika gresaka: nikad ne baca. Losa ili polovicna mapa sme da ugasi hover
 * preview, ali ne sme da sruši plejer — premotavanje je vaznije od sličice.
 * Neispravni cue-ovi se tiho preskacu.
 */
export function parseThumbnailVtt(text: string, baseUrl: string): ThumbnailCue[] {
  const cues: ThumbnailCue[] = [];

  for (const block of text.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    // Redni broj cue-a je opcion, kao i u SRT-u — trazi se linija sa strelicom.
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const [rawStart, rawEnd] = lines[timingIndex]!.split("-->");
    const start = parseTimestamp(rawStart ?? "");
    // Posle kraja mogu stajati cue podesavanja ("align:start"); visak se odbacuje.
    const end = parseTimestamp((rawEnd ?? "").trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null || end <= start) continue;

    const payload = lines[timingIndex + 1]?.trim();
    if (!payload) continue;

    const match = XYWH.exec(payload);
    // Cue bez #xywh je obican titl, ne isecak sprite-a — preskace se.
    if (!match) continue;

    const src = resolveAgainst(payload.replace(XYWH, ""), baseUrl);
    if (src === null) continue;

    const [, x, y, w, h] = match;
    const width = Number(w);
    const height = Number(h);
    if (width <= 0 || height <= 0) continue;

    cues.push({ start, end, src, x: Number(x), y: Number(y), w: width, h: height });
  }

  // Sortiranje je jeftino, a `cueAt` racuna na njega — ne oslanjaj se na to da
  // je generator upisao cue-ove u redosledu.
  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Sličica za dati trenutak, ili `null` ako ga nijedan cue ne pokriva.
 *
 * Binarna pretraga: `onPointerMove` okida na svaki piksel pomeraja, pa linearni
 * prolaz kroz ~200 cue-ova nema razloga da postoji.
 */
export function cueAt(cues: readonly ThumbnailCue[], seconds: number): ThumbnailCue | null {
  let low = 0;
  let high = cues.length - 1;
  let found: ThumbnailCue | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid]!;

    if (seconds < cue.start) {
      high = mid - 1;
    } else {
      // Kandidat: pocinje pre trazenog trenutka. Trazi se poslednji takav.
      found = cue;
      low = mid + 1;
    }
  }

  // Poslednji cue pokriva samo do svog kraja — hover iza njega nema sličicu.
  return found && seconds < found.end ? found : null;
}
