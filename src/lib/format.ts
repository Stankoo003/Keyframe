/**
 * Formatiranje vremena za prikaz.
 *
 * Ulaz su uvek CELE SEKUNDE — ista jedinica kao `Video.durationSeconds` i
 * `Chapter.startSeconds` u bazi.
 */

/**
 * Trajanje ili vremenska oznaka.
 *
 * Sat se pojavljuje samo kad postoji, kako je i u dizajnu (`38:12`, `1:52:04`).
 *
 * @example
 * formatTime(0)     // "0:00"
 * formatTime(2292)  // "38:12"
 * formatTime(6724)  // "1:52:04"
 */
export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * Duzine poglavlja.
 *
 * Model cuva samo pocetak, pa se duzina izvodi: do pocetka sledeceg, a
 * poslednje traje do kraja videa.
 */
export function chapterDurations(starts: readonly number[], totalSeconds: number): number[] {
  return starts.map((start, index) => {
    const next = starts[index + 1] ?? totalSeconds;
    return Math.max(0, next - start);
  });
}

/**
 * Index poglavlja koje traje u trenutku `time`.
 *
 * Vraca -1 kad poglavlja nema, ili kad je `time` pre prvog pocetka (moguce ako
 * prvo poglavlje ne krece od nule).
 *
 * Trazi od kraja: prvo poglavlje cij je pocetak <= `time` i jeste tekuce, jer su
 * pocetci rastuci. Time nema potrebe gledati sledeci element ni trajanje.
 *
 * @example
 * currentChapterIndex([0, 90, 186], 95)  // 1
 * currentChapterIndex([0, 90, 186], 0)   // 0
 * currentChapterIndex([], 12)            // -1
 */
export function currentChapterIndex(starts: readonly number[], time: number): number {
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    if (time >= (starts[index] ?? 0)) return index;
  }
  return -1;
}
